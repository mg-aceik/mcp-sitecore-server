import { McpServer } from "@modelcontextprotocol/server";
import { envSchema, redactConfig, type Config, type EnvConfig } from "./config.js";
import fs from 'fs';
import path from 'path';
import { registerAll } from "./register.js";
import { withInferredAnnotations } from "./tool-annotations.js";
import { resolveToolGating, withToolGating } from "./tool-profiles.js";



export async function getServer(config: Config): Promise<McpServer> {
    const server = new McpServer({
        name: `Sitecore MCP Server: ${config.name}`,
        description: "Model Context Protocol for Sitecore",
        version: config.version || "0.0.1",
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
