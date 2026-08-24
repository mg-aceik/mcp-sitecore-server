import { McpServer } from "@modelcontextprotocol/server";
import { envSchema, redactConfig, type Config, type EnvConfig } from "./config.js";
import fs from 'fs';
import path from 'path';
import { registerAll } from "./register.js";
import { withInferredAnnotations } from "./tool-annotations.js";
import { resolveToolGating, withToolGating } from "./tool-profiles.js";



export async function getServer(config: Config): Promise<McpServer> {
    // One string for both the advertised name and the instructions below, so a client that
    // reads only one of the two still sees the same identity.
    const serverName = `Sitecore MCP Server: ${config.name}`;

    const server = new McpServer({
        name: serverName,
        description: "Model Context Protocol for Sitecore",
        version: config.version || "0.0.1",
    }, {
        // `initialize` hands these back to the client verbatim, and clients that surface
        // instructions put them in the model's context. Stating the name here means an
        // agent connected to several MCP servers at once can tell which one these tools
        // came from -- the `serverInfo.name` above is metadata a model never necessarily
        // sees.
        instructions:
            `This server is named "${serverName}". Refer to it by that name when reporting `
            + `which server a tool or result came from.`,
    });

    // Automatically attach inferred read-only/destructive annotations to every tool
    // registered below, so MCP clients can distinguish safe reads from mutations.
    withInferredAnnotations(server);

    // Tool gating (TOOL_GROUPS / DISABLED_TOOLS / TOOL_PROFILE). Applied before the
    // first registerTool call so DISABLED_TOOLS covers every tool in the server.
    const gating = resolveToolGating();
    withToolGating(server, gating);

    // Parse the environment variables and set default values

    // Both of these are readable by any connected client, so the passwords, the GraphQL
    // API key and the server's own bearer token are masked. Everything an agent needs from
    // them -- which endpoint, which account, which schemas -- survives redaction.
    const visibleConfig = redactConfig(config);

    server.registerResource("config", "config://main", {}, async (uri) => {
                    return {
                        contents: [{
                            uri: uri.href,
                            text: JSON.stringify(visibleConfig, null, 2),
                        }]
                    }
                });

    server.registerTool(
        "config",
        {
            description:
                "Prints the configuration of the Sitecore MCP server. Secrets (passwords, the "
                + "GraphQL API key, the authorization header) are redacted.",
        },
        async (params) => {
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(visibleConfig, null, 2)
                    }
                ]
            };
        }
    );
    await registerAll(server, config, gating);

    return server;
}
