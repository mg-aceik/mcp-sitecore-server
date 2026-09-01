/**
 * DNS-rebinding and cross-site protection for the Streamable HTTP transport.
 *
 * A browser cannot reach this endpoint cross-origin on its own: `/mcp` takes
 * `application/json`, which is not a CORS-simple content type, and no CORS headers are
 * sent, so the preflight fails. DNS rebinding steps around that entirely. A page on
 * `attacker.example` whose name resolves first to the attacker's own address and then, on
 * the next lookup, to `127.0.0.1` is treated by the browser as *same-origin* with whatever
 * is listening there: no preflight, no `Origin` header, and full read access to the
 * response. The MCP specification requires servers to validate `Origin` for exactly this
 * reason, and the SDK does not do it for us.
 *
 * The load-bearing check is the `Host` header, because that is the one thing the rebound
 * request cannot forge: the browser sends the name the page was loaded from
 * (`attacker.example`), not the address it resolved to. A request that reaches this
 * process carrying a `Host` this operator never published is not a client that meant to
 * talk to it. `Origin` is checked alongside it to catch the ordinary cross-site case.
 *
 * Non-browser clients are unaffected: an absent header is allowed through, since only a
 * browser is obliged to send `Origin`, and only a browser can be made to lie about `Host`.
 */

/**
 * Hostnames accepted with no configuration.
 *
 * These are the addresses the server is reachable at when it is doing what it does by
 * default — bound to loopback, driven by a client on the same machine — plus `localhost`
 * as published by a Docker port mapping, where the container's own port (3001) is not the
 * one the browser connects to. Ports are not compared for that reason.
 */
const DEFAULT_ALLOWED_HOSTNAMES = ["localhost", "127.0.0.1", "::1"];

/** Any deployment reached by a name of its own has to say so. */
export const ALLOWED_HOSTS_ENV = "MCP_ALLOWED_HOSTS";

/**
 * The hostname in a `Host` or `Origin` header value, lowercased and without its port or
 * IPv6 brackets, or `undefined` when the value is not something a hostname can be read
 * from.
 *
 * Parsing rather than splitting on `:`: an IPv6 literal is full of colons, and `Host` may
 * carry it as `[::1]:3001` while `Origin` carries a whole URL. The URL parser handles
 * both, and normalises the case and the brackets on the way.
 */
export function hostnameOf(value: string | undefined): string | undefined {
    const trimmed = value?.trim();
    if (!trimmed) {
        return undefined;
    }
    // A bare authority ('localhost:3001') is not a URL, so give it a scheme; a whole URL
    // ('http://localhost:3001') already has one and is left alone.
    const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
    let parsed: URL;
    try {
        parsed = new URL(candidate);
    } catch {
        return undefined;
    }
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === "") {
        return undefined;
    }
    // new URL keeps an IPv6 literal in its brackets; the allowlist holds bare addresses.
    return hostname.startsWith("[") && hostname.endsWith("]")
        ? hostname.slice(1, -1)
        : hostname;
}

export type AllowedHosts =
    /** `MCP_ALLOWED_HOSTS=*`: the operator has taken the check off. */
    | { any: true }
    | { any: false; hostnames: Set<string> };

/**
 * The hostnames this server answers to.
 *
 * `MCP_ALLOWED_HOSTS` *adds* to the loopback defaults rather than replacing them, so
 * naming a public hostname does not quietly break the health check or a local client. `*`
 * disables the check, for a deployment whose hostname is not known ahead of time — behind
 * a proxy that forwards several, say. It is a deliberate opt-out and is reported at
 * startup.
 */
export function resolveAllowedHosts(env: NodeJS.ProcessEnv = process.env): AllowedHosts {
    const raw = (env[ALLOWED_HOSTS_ENV] ?? "").trim();
    if (raw === "*") {
        return { any: true };
    }

    const hostnames = new Set(DEFAULT_ALLOWED_HOSTNAMES);
    for (const entry of raw.split(",")) {
        const hostname = hostnameOf(entry);
        if (hostname) {
            hostnames.add(hostname);
        }
    }
    return { any: false, hostnames };
}

export type HostCheck = { ok: true } | { ok: false; header: "Host" | "Origin"; reason: string };

/**
 * Decides whether a request's `Host` and `Origin` name somewhere this server is served
 * from.
 *
 * Returns the refusal rather than throwing, so the caller owns the response shape, and
 * names the offending header and the variable that would permit it — a wrongly refused
 * request is otherwise indistinguishable from the server being down.
 */
export function checkRequestHost(
    headers: { host?: string; origin?: string },
    allowed: AllowedHosts
): HostCheck {
    if (allowed.any) {
        return { ok: true };
    }

    // Absent means "not a browser": `Origin` is only obliged of one, and only a browser
    // can be induced to send a `Host` it did not choose. A CLI client, a container health
    // check over a raw socket and curl are all allowed through as before.
    const host = hostnameOf(headers.host);
    if (host !== undefined && !allowed.hostnames.has(host)) {
        return {
            ok: false,
            header: "Host",
            reason:
                `Refused: the request's Host header names '${host}', which this server is not `
                + `configured to answer to. If this deployment is reached by that name, add it to `
                + `${ALLOWED_HOSTS_ENV} (comma-separated). This check exists to stop a DNS-rebinding `
                + `attack driving this server from a web page.`,
        };
    }

    const origin = hostnameOf(headers.origin);
    if (origin !== undefined && !allowed.hostnames.has(origin)) {
        return {
            ok: false,
            header: "Origin",
            reason:
                `Refused: the request's Origin header names '${origin}', which is not an origin `
                + `this server is configured to serve. Add it to ${ALLOWED_HOSTS_ENV} `
                + `(comma-separated) if a page there is meant to reach this endpoint.`,
        };
    }

    return { ok: true };
}
