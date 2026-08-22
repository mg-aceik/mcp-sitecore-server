import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { requireOneTarget } from "@/tools/target-input.js";
import { runGenericPowershellCommand } from "../generic.js";

export function mergeLayoutPowershellTool(server: McpServer, config: Config) {
    server.registerTool(
        "presentation-merge-layout",
        {
            description: "Merges final and shared layouts of an item.",
            inputSchema: {
                id: z.string().optional()
                    .describe("The ID of the item to merge layout for. Supply this or path."),
                path: z.string().optional()
                    .describe("The path of the item to merge layout for. Supply this or id."),
                database: z.string().optional()
                    .describe("The database to merge layout for. Only sent when addressing by id -- a path carries its own database prefix (e.g. master:/sitecore/content/Home)."),
                language: z.string().optional().describe("The item language to merge layout for."),
            },
        },
        async (params) => {
            const invalid = requireOneTarget(params, ["id", "path"]);
            if (invalid) {
                return invalid;
            }

            const command = `Merge-Layout`;
            const options: Record<string, any> = {};

            // Each branch sends exactly what its own tool sent: the ID form took a database,
            // the path form never did.
            if (params.id) {
                options["Id"] = params.id;
                options["Database"] = params.database;
            } else {
                options["Path"] = params.path;
            }

            options["Language"] = params.language;

            return safeMcpResponse(runGenericPowershellCommand(config, command, options));
        }
    );
}
