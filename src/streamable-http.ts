import express from "express";
import type { Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "node:crypto";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { getServer } from "./server.js";
import { config } from "./config.js";
import { authorizationHeaderName } from "./const.js";

/** Default listen port, overridable with PORT (and HOST for the interface to bind). */
const DEFAULT_PORT = 3001;

/**
 * Body cap for the MCP endpoint. Express defaults to 100kb, which is under the size of a
 * single base64 image: `media-upload`'s inline `content` failed on anything real, and
 * failed as an Express HTML error rather than as JSON. 32mb leaves headroom for a media
 * payload while still bounding what one request can allocate.
 */
const DEFAULT_BODY_LIMIT = "32mb";

/**
 * Compares the presented credential against the configured one without leaking, through
 * the time it takes to fail, how many leading characters were right.
 */
function secretsMatch(expected: string, presented: string): boolean {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(presented, "utf8");
    if (a.length !== b.length) {
        // timingSafeEqual throws on a length mismatch. Compare the value against itself so
        // the work done is the same either way, then report the mismatch.
        timingSafeEqual(a, a);
        return false;
    }
    return timingSafeEqual(a, b);
}

export function startStreamableHTTP() {
    const app = express();
    app.use(express.json({ limit: process.env.MCP_BODY_LIMIT || DEFAULT_BODY_LIMIT }));

    // There is no transport map here any more, and nothing to key one on. The
    // 2026-07-28 protocol has no initialize handshake and no protocol-level session,
    // so `createMcpHandler` serves each exchange from a fresh server built by this
    // factory and holds nothing between exchanges. It also serves 2025-era clients
    // off the same factory, statelessly, so an older client keeps working without a
    // session map of its own -- 2025's GET and DELETE session operations answer 405,
    // which is what a stateless endpoint has always answered.
    //
    // Building a server per request is affordable because registration is pure
    // in-memory work (~23ms for all 119 tools) and every tool call behind it is a
    // Sitecore round trip an order of magnitude slower. The PowerShell and
    // ItemService clients are constructed per call from config and hold no session,
    // so nothing in the tool layer notices.
    const mcp = createMcpHandler(() => getServer(config), {
        onerror: (error) => console.error("MCP handler error:", error),
    });
    const handleMcp = toNodeHandler(mcp, {
        onerror: (error) => console.error("MCP node adapter error:", error),
    });

    // Inspector adds "Bearer" to the authorization header, so we need to strip it. The
    // pattern is anchored: an unanchored replace would also strip the substring out of the
    // middle of a token that happens to contain it.
    const authorize = (req: Request, res: Response, next: NextFunction) => {
        const authHeaderValue = (req.headers[authorizationHeaderName] as string ?? "")
            .replace(/^\s*Bearer\s+/i, '');
        if (config.authorizationHeader === "" ||
            secretsMatch(config.authorizationHeader, authHeaderValue)) {
            next();
            return;
        }
        res.status(401).json({ error: 'Unauthorized' });
    };

    // One route for every method. The handler classifies the request's protocol era
    // itself and answers the methods that era supports.
    app.all('/mcp', authorize, (req, res) => {
        // `express.json()` has already drained the request stream, so the parsed body
        // has to be handed over explicitly -- there is nothing left to read from req.
        void handleMcp(req, res, req.body);
    });

    // Lightweight liveness endpoint for container/orchestrator health checks. It only
    // reports that the HTTP server is accepting requests (not MCP session state), which
    // is the right signal for a Docker HEALTHCHECK.
    app.get('/health', (_req, res) => {
        res.status(200).json({ status: 'ok' });
    });

    // RFC 9728 OAuth Protected Resource Metadata. Some MCP clients (e.g. Claude
    // Code) proactively probe this endpoint before sending the first MCP request
    // to decide whether the server is OAuth-protected. If the probe fails or
    // 404s, those clients flag the server as "needs authentication" and refuse
    // to connect anonymously. Returning a 200 with an empty `authorization_servers`
    // array is the canonical "I am not OAuth-protected" signal — the client then
    // skips the OAuth flow and connects directly to /mcp.
    app.get('/.well-known/oauth-protected-resource', (req, res) => {
        const host = req.headers.host ?? 'localhost';
        const proto = (req.headers['x-forwarded-proto'] as string) ?? req.protocol ?? 'http';
        res.status(200).json({
            resource: `${proto}://${host}/mcp`,
            authorization_servers: [],
        });
    });

    // JSON 404 fallback for any other unknown routes (e.g. /register,
    // /.well-known/oauth-authorization-server). Without this, Express's default
    // HTML 404 (`<!DOCTYPE html>...Cannot POST /register`) makes Claude Code's
    // OAuth client crash on `JSON.parse('<...')`.
    app.use((_req, res) => {
        res.status(404).json({ error: 'Not found' });
    });

    // Anything that throws below the routes — `express.json()`'s SyntaxError on a
    // malformed body, its 413 on an oversized one — must answer in JSON for the same
    // reason the 404 above does: Express's default HTML error page crashes a client that
    // assumes a JSON response.
    app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
        if (res.headersSent) {
            return next(err);
        }
        const status = typeof err?.status === "number" ? err.status : 400;
        res.status(status).json({
            error: err?.type === "entity.too.large" ? "Payload too large" : "Bad request",
            detail: String(err?.message ?? err),
        });
    });

    const port = Number(process.env.PORT) || DEFAULT_PORT;
    const host = process.env.HOST || undefined;

    const server = host ? app.listen(port, host) : app.listen(port);
    server.on("listening", () => {
        console.error(`MCP Streamable HTTP listening on ${host ?? "0.0.0.0"}:${port}/mcp`);
    });
    server.on("error", (error: NodeJS.ErrnoException) => {
        if (error.code === "EADDRINUSE") {
            console.error(
                `Port ${port} is already in use. Set PORT to a free port, or stop the process `
                + `already listening on it.`
            );
        } else {
            console.error("MCP HTTP server error:", error);
        }
        process.exitCode = 1;
    });
}
