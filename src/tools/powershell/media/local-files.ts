import path from "node:path";
import { lookup } from "node:dns/promises";
import { fetchWithTimeout } from "@/utils.js";

/**
 * Guards for the two things the media tools do outside Sitecore: read a file from the
 * machine running this server, and fetch a URL from wherever this server sits on the
 * network.
 *
 * Both are safe on stdio, where the MCP server is a subprocess of the user's own client
 * and can already do anything that user can. Neither is safe on `TRANSPORT=streamable-http`,
 * where `AUTHORIZATION_HEADER` is empty by default: `filePath` would be arbitrary file
 * read and `saveTo` arbitrary file write, for anyone who can reach the port. So the
 * local-filesystem parameters are refused there unless an operator opts in by naming a
 * directory to confine them to.
 */

/**
 * True when this process is serving MCP over HTTP rather than stdio.
 *
 * This must agree with `envStartSchema` in config.ts, which is what actually picks the
 * transport: unset, empty and unrecognised all mean stdio, and only `streamable-http`
 * (or the legacy `sse`, which falls through to it) starts an HTTP listener. Assuming
 * "anything that is not stdio is HTTP" would refuse local file access on the default
 * stdio setup, where it is exactly the case the parameters exist for.
 */
function isHttpTransport(env: NodeJS.ProcessEnv): boolean {
    const transport = (env.TRANSPORT ?? "").trim().toLowerCase();
    return transport === "streamable-http" || transport === "sse";
}

export class LocalFileAccessError extends Error {}

/**
 * Resolves a caller-supplied local path to an absolute path, or throws with a message
 * that says how to enable the access rather than just refusing it.
 *
 * `MEDIA_LOCAL_FILE_ROOT`, when set, confines every local path to that directory on both
 * transports. When unset, local paths work on stdio and are refused over HTTP.
 */
export function resolveLocalMediaPath(
    candidate: string,
    parameterName: "filePath" | "saveTo",
    env: NodeJS.ProcessEnv = process.env
): string {
    const root = (env.MEDIA_LOCAL_FILE_ROOT ?? "").trim();

    if (!root) {
        if (isHttpTransport(env)) {
            throw new LocalFileAccessError(
                `'${parameterName}' reads and writes the filesystem of the machine running this `
                + `MCP server, which is refused over the HTTP transport because anyone who can `
                + `reach the endpoint could use it. Set MEDIA_LOCAL_FILE_ROOT to a directory to `
                + `allow it, confined to that directory; or use 'sourceUrl'/inline 'content' `
                + `instead, which do not touch this machine's filesystem.`
            );
        }
        return path.resolve(candidate);
    }

    const resolvedRoot = path.resolve(root);
    const resolved = path.resolve(resolvedRoot, candidate);
    const relative = path.relative(resolvedRoot, resolved);
    // An empty relative path is the root itself; one starting with '..' escaped it. On
    // Windows, path.relative also returns an absolute path when the drives differ.
    if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
        throw new LocalFileAccessError(
            `'${parameterName}' resolves to '${resolved}', which is outside MEDIA_LOCAL_FILE_ROOT `
            + `('${resolvedRoot}'). Pass a path inside that directory.`
        );
    }
    return resolved;
}

/** Address ranges a server-side fetch must not reach on the caller's behalf. */
function isPrivateAddress(address: string, family: number): boolean {
    if (family === 6) {
        const normalized = address.toLowerCase().split("%")[0];
        if (normalized === "::1" || normalized === "::" ) {
            return true;
        }
        // Unique-local (fc00::/7) and link-local (fe80::/10).
        if (/^f[cd]/.test(normalized) || /^fe[89ab]/.test(normalized)) {
            return true;
        }
        // IPv4-mapped, e.g. ::ffff:169.254.169.254.
        const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(normalized);
        return mapped ? isPrivateAddress(mapped[1], 4) : false;
    }

    const octets = address.split(".").map(Number);
    if (octets.length !== 4 || octets.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) {
        return true;
    }
    const [a, b] = octets;
    return (
        a === 0                                   // "this network"
        || a === 10                               // RFC 1918
        || a === 127                              // loopback
        || (a === 100 && b >= 64 && b <= 127)     // RFC 6598 carrier-grade NAT
        || (a === 169 && b === 254)               // link-local, incl. cloud metadata
        || (a === 172 && b >= 16 && b <= 31)      // RFC 1918
        || (a === 192 && b === 168)               // RFC 1918
        || a >= 224                               // multicast and reserved
    );
}

export class SourceUrlError extends Error {}

/**
 * Validates a `sourceUrl` before the server fetches it.
 *
 * The server fetches this URL from wherever it is deployed, so an unrestricted value is a
 * server-side request forgery primitive: the cloud metadata endpoint at 169.254.169.254,
 * anything on the CM's private network, `file:`. Only http(s) is allowed, and the
 * hostname's resolved addresses must be public unless
 * `MEDIA_ALLOW_PRIVATE_SOURCE_URL=true` says the deployment is deliberately fetching from
 * its own network.
 */
export async function assertFetchableSourceUrl(
    sourceUrl: string,
    env: NodeJS.ProcessEnv = process.env
): Promise<URL> {
    let url: URL;
    try {
        url = new URL(sourceUrl);
    } catch {
        throw new SourceUrlError(`'sourceUrl' is not a valid URL: ${sourceUrl}`);
    }

    if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new SourceUrlError(
            `'sourceUrl' must be http or https. '${url.protocol}' is refused — use 'filePath' `
            + `for a file on this machine.`
        );
    }

    if (String(env.MEDIA_ALLOW_PRIVATE_SOURCE_URL ?? "").toLowerCase() === "true") {
        return url;
    }

    let addresses: { address: string; family: number }[];
    try {
        addresses = await lookup(url.hostname, { all: true });
    } catch {
        throw new SourceUrlError(`'sourceUrl' host '${url.hostname}' could not be resolved.`);
    }

    const blocked = addresses.filter((entry) => isPrivateAddress(entry.address, entry.family));
    if (blocked.length > 0) {
        throw new SourceUrlError(
            `'sourceUrl' host '${url.hostname}' resolves to a private, loopback or link-local `
            + `address (${blocked.map((entry) => entry.address).join(", ")}), which this server `
            + `will not fetch on a caller's behalf. Set MEDIA_ALLOW_PRIVATE_SOURCE_URL=true if `
            + `importing from your own network is intended.`
        );
    }

    return url;
}

/** HTTP status codes that fetch would follow to a Location header. */
function isRedirectStatus(status: number): boolean {
    return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

/**
 * Fetches a caller-supplied `sourceUrl`, re-running {@link assertFetchableSourceUrl} against
 * every hop.
 *
 * Validating only the first URL and then letting fetch follow redirects is an SSRF bypass:
 * a public host that passes the check can answer with `302 Location: http://169.254.169.254/...`
 * and the default `redirect: "follow"` walks straight into the metadata endpoint or the CM's
 * private network. So redirects are handled manually here and each `Location` is validated
 * before it is followed, with a bounded hop count. The final resolved URL is returned so
 * callers can derive a file name from the resource actually fetched.
 */
export async function fetchSourceUrl(
    sourceUrl: string,
    timeoutMs: number,
    env: NodeJS.ProcessEnv = process.env
): Promise<{ response: Response; url: URL }> {
    const maxRedirects = 5;
    let url = await assertFetchableSourceUrl(sourceUrl, env);

    for (let hop = 0; ; hop++) {
        const response = await fetchWithTimeout(url.toString(), { redirect: "manual" }, timeoutMs);
        if (!isRedirectStatus(response.status)) {
            return { response, url };
        }

        const location = response.headers.get("location");
        if (!location) {
            // A redirect status with no target: nothing to follow, hand it back as-is.
            return { response, url };
        }
        if (hop >= maxRedirects) {
            throw new SourceUrlError(
                `'sourceUrl' exceeded ${maxRedirects} redirects; refusing to follow further.`
            );
        }

        let next: URL;
        try {
            next = new URL(location, url);
        } catch {
            throw new SourceUrlError(`'sourceUrl' redirected to an invalid location: ${location}`);
        }
        url = await assertFetchableSourceUrl(next.toString(), env);
    }
}
