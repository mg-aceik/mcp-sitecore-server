import { type Config } from "@/config.js";
import { fetchWithTimeout } from "@/utils.js";

/**
 * The client for the Sitecore Authoring and Management GraphQL API.
 *
 * Two things distinguish it from the Edge client in `../graphql/`:
 *
 * - **Auth is a bearer token, not an API key.** Either supplied whole (`AUTHORING_TOKEN`)
 *   or minted here from a client-credentials grant. The grant is what a long-running MCP
 *   session needs: tokens carry an `expires_in` measured in hours, and a supplied one goes
 *   stale mid-session with no way to renew it.
 * - **A GraphQL 200 is not a success.** The API answers an unauthorized call with HTTP 200
 *   and an `AUTH_NOT_AUTHENTICATED` entry in `errors` (verified against a live CM), so a
 *   client that only checks `response.ok` reports "no data returned" for what is really a
 *   credentials problem.
 */

/** How early to treat a token as expired, so a call never races the expiry. */
const TOKEN_EXPIRY_SKEW_MS = 60_000;

type CachedToken = {
    accessToken: string;
    /** Epoch ms after which this token must not be used. */
    expiresAt: number;
};

/**
 * Cached per (authority, audience, clientId) so a config change mints a new token rather
 * than reusing one issued for different credentials. Process-wide, because the HTTP
 * transport builds a fresh `McpServer` per request and a per-server cache would request a
 * token on every single tool call.
 */
const tokenCache = new Map<string, CachedToken>();

/** In-flight requests, so N concurrent tool calls make one token request, not N. */
const inFlight = new Map<string, Promise<CachedToken>>();

/** Test seam: drop every cached token. */
export function resetAuthoringTokenCache(): void {
    tokenCache.clear();
    inFlight.clear();
}

export class AuthoringAuthError extends Error {}

function cacheKey(conf: Config): string {
    const { authority, audience, clientId } = conf.authoring;
    return `${authority}|${audience}|${clientId}`;
}

/**
 * Runs the client-credentials grant.
 *
 * https://doc.sitecore.com/sai/en/developers/sitecoreai/content-modeling-and-presentation/sitecore-authoring-and-management-graphql-api/walkthrough--enabling-and-authorizing-requests-to-the-authoring-and-management-api.html
 */
async function requestToken(conf: Config): Promise<CachedToken> {
    const { authority, audience, clientId, clientSecret } = conf.authoring;
    const url = `${authority.replace(/\/+$/, "")}/oauth/token`;

    const body = new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
        audience,
    });

    let response: Response;
    try {
        response = await fetchWithTimeout(url, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: body.toString(),
        });
    } catch (error) {
        throw new AuthoringAuthError(
            `Requesting an access token from ${url} failed: `
            + `${error instanceof Error ? error.message : String(error)}`
        );
    }

    // The body carries the reason ("invalid_client", "access_denied", an audience typo),
    // and the status alone does not. Surface it -- with the secret nowhere in sight.
    const text = await response.text();
    if (!response.ok) {
        throw new AuthoringAuthError(
            `The token endpoint ${url} returned ${response.status} ${response.statusText}. `
            + `Check AUTHORING_CLIENT_ID, AUTHORING_CLIENT_SECRET and AUTHORING_AUDIENCE `
            + `('${audience}'). Response: ${text.slice(0, 500)}`
        );
    }

    let parsed: { access_token?: string; expires_in?: number; token_type?: string };
    try {
        parsed = JSON.parse(text);
    } catch {
        throw new AuthoringAuthError(
            `The token endpoint ${url} returned ${response.status} but the body was not JSON: `
            + `${text.slice(0, 500)}`
        );
    }

    if (!parsed.access_token) {
        throw new AuthoringAuthError(
            `The token endpoint ${url} returned no 'access_token'. Response: ${text.slice(0, 500)}`
        );
    }

    // Treat a missing or nonsensical expires_in as one minute rather than forever: a token
    // cached past its life turns every later call into a 401 that no retry clears.
    const lifetimeSeconds = typeof parsed.expires_in === "number" && parsed.expires_in > 0
        ? parsed.expires_in
        : 60;

    return {
        accessToken: parsed.access_token,
        expiresAt: Date.now() + lifetimeSeconds * 1000 - TOKEN_EXPIRY_SKEW_MS,
    };
}

/**
 * The bearer token to send, minting and caching one if needed.
 *
 * `AUTHORING_TOKEN` wins when set, so an operator holding a token from
 * `dotnet sitecore cloud login` can use it without registering an automation client.
 */
export async function getAuthoringToken(conf: Config): Promise<string> {
    const { token, clientId, clientSecret } = conf.authoring;

    if (token.trim() !== "") {
        return token.trim();
    }

    if (clientId.trim() === "" || clientSecret.trim() === "") {
        throw new AuthoringAuthError(
            "The Authoring and Management API needs a bearer token, and none is configured. "
            + "Set AUTHORING_CLIENT_ID and AUTHORING_CLIENT_SECRET to let this server mint one "
            + "(the client-credentials grant -- on SitecoreAI these come from an XM Cloud Deploy "
            + "automation client with the xmcloud.cm:admin scope), or set AUTHORING_TOKEN to a "
            + "token you already hold, such as the accessToken in .sitecore/user.json after "
            + "`dotnet sitecore cloud login`."
        );
    }

    const key = cacheKey(conf);
    const cached = tokenCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.accessToken;
    }

    const pending = inFlight.get(key);
    if (pending) {
        return (await pending).accessToken;
    }

    const request = requestToken(conf)
        .then((fresh) => {
            tokenCache.set(key, fresh);
            return fresh;
        })
        .finally(() => {
            inFlight.delete(key);
        });
    inFlight.set(key, request);

    return (await request).accessToken;
}

export type GraphQLError = {
    message: string;
    path?: (string | number)[];
    extensions?: Record<string, unknown>;
};

/**
 * Executes one document against the Authoring and Management endpoint and returns its
 * `data`, throwing on anything the caller should not mistake for a result.
 */
export async function executeAuthoringGraphQL(
    conf: Config,
    query: string,
    variables?: Record<string, unknown>
): Promise<unknown> {
    const accessToken = await getAuthoringToken(conf);
    const url = conf.authoring.endpoint;

    const response = await fetchWithTimeout(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ query, variables }),
    });

    const text = await response.text();

    if (!response.ok) {
        // A 404 here almost always means GraphQL is switched off rather than a wrong URL,
        // and that is a config patch away -- say so instead of just the status.
        const hint = response.status === 404
            ? ` The endpoint returned 404: check that '${url}' is right and that GraphQL.Enabled `
            + `is true on the CM.`
            : response.status === 401 || response.status === 403
                ? " The token was rejected: check the audience and that the client has access to "
                + "this environment."
                : "";
        throw new Error(
            `The Authoring and Management API returned ${response.status} `
            + `${response.statusText}.${hint} Response: ${text.slice(0, 1000)}`
        );
    }

    let parsed: { data?: unknown; errors?: GraphQLError[] };
    try {
        parsed = JSON.parse(text);
    } catch {
        throw new Error(
            `The Authoring and Management API returned a non-JSON body: ${text.slice(0, 1000)}`
        );
    }

    if (parsed.errors && parsed.errors.length > 0) {
        const codes = parsed.errors
            .map((error) => error.extensions?.code)
            .filter((code): code is string => typeof code === "string");
        // The unauthenticated case arrives as a 200 with this code, so it would otherwise
        // read as an ordinary query error rather than the credentials problem it is.
        const hint = codes.includes("AUTH_NOT_AUTHENTICATED")
            ? " The request reached the endpoint but was not authenticated. The token is missing, "
            + "expired, or issued for a different audience or environment."
            : "";
        throw new Error(
            `The Authoring and Management API reported errors:${hint} `
            + JSON.stringify(parsed.errors)
        );
    }

    return parsed.data;
}
