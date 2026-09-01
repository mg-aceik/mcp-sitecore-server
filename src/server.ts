import { McpServer } from "@modelcontextprotocol/server";
import { redactConfig, type Config } from "./config.js";
import { registerAll } from "./register.js";
import { withInferredAnnotations } from "./tool-annotations.js";
import { resolveToolGating, withToolGating } from "./tool-profiles.js";
import { ROUTING_INSTRUCTIONS, TOOL_SELECTION_GUIDE } from "./tool-guide.js";
import { registerGuides } from "./guides/register-guides.js";



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
        //
        // The routing block after it is the only channel that can steer a choice *between*
        // tool families, because it arrives before any tool has been picked. A tool's own
        // description cannot say "use the other family instead" until the model is already
        // reading that tool. It is kept short deliberately: this is paid once per session
        // whether or not a single Sitecore tool is called, and the long form is one
        // resource read away.
        instructions:
            `This server is named "${serverName}". Refer to it by that name when reporting `
            + `which server a tool or result came from.\n\n`
            + ROUTING_INSTRUCTIONS,
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

    // The guidance an agent needs *after* it has chosen a family: the measured costs, the
    // subtree alternatives, the depth cap and the rest. A resource rather than a tool,
    // because a tool's schema is paid for on every turn while a resource costs nothing
    // until it is read, and the instructions above name this URI so the agent knows it is
    // there. `docs/tool-selection.md` is the human counterpart and covers the environment
    // variables instead; this is not a copy of it.
    server.registerResource(
        "tool-selection",
        "guide://tool-selection",
        {
            title: "Choosing a Sitecore tool",
            description:
                "Which Sitecore surface answers which question, and what each costs: measured "
                + "read latencies, the cheap ways to read a subtree, and the limits (query depth, "
                + "index lag, result caps) worth knowing before writing a query. Also names the "
                + "other guide:// resources, which a client lists separately from its tools.",
            mimeType: "text/markdown",
        },
        async (uri) => {
            return {
                contents: [{
                    uri: uri.href,
                    mimeType: "text/markdown",
                    text: TOOL_SELECTION_GUIDE,
                }]
            };
        }
    );

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
        async () => {
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

    // After the tools, so gating decides which procedures are worth offering. A resource
    // costs nothing until it is read, which is why the long-form procedures live here
    // rather than in the instructions above -- and unlike a one-shot prompt injection, a
    // resource can be read at the point the question arises, several calls into a build.
    registerGuides(server, gating);

    return server;
}
