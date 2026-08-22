import express from "express";
import type { Request, Response, NextFunction } from "express";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { getServer } from "./server.js";
import { config } from "./config.js";
import { authorizationHeaderName } from "./const.js";

export function startStreamableHTTP() {
    const app = express();
    app.use(express.json());

    // There is no transport map here any more, and nothing to key one on. The
    // 2026-07-28 protocol has no initialize handshake and no protocol-level session,
    // so `createMcpHandler` serves each exchange from a fresh server built by this
    // factory and holds nothing between exchanges. It also serves 2025-era clients
    // off the same factory, statelessly, so an older client keeps working without a
    // session map of its own -- 2025's GET and DELETE session operations answer 405,
    // which is what a stateless endpoint has always answered.
    //
    // Building a server per request is affordable because registration is pure
    // in-memory work (~23ms for all ~111 tools) and every tool call behind it is a
    // Sitecore round trip an order of magnitude slower. The PowerShell and
    // ItemService clients are constructed per call from config and hold no session,
    // so nothing in the tool layer notices.
    const mcp = createMcpHandler(() => getServer(config), {
        onerror: (error) => console.error("MCP handler error:", error),
    });
    const handleMcp = toNodeHandler(mcp, {
        onerror: (error) => console.error("MCP node adapter error:", error),
    });

    // Inspector adds "Bearer" to the authorization header, so we need to strip it
    const authorize = (req: Request, res: Response, next: NextFunction) => {
        const authHeaderValue = (req.headers[authorizationHeaderName] as string ?? "")
            .replace(/Bearer\s+/i, '');
        if (config.authorizationHeader === "" ||
            config.authorizationHeader === authHeaderValue) {
            next();
            return;
        }
        res.status(401).send('Unauthorized');
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

    app.listen(3001);
}
