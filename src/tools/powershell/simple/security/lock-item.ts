import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { requireOneTarget } from "@/tools/target-input.js";
import { runGenericPowershellCommand } from "../generic.js";

export function lockItemPowerShellTool(server: McpServer, config: Config) {
    server.registerTool(
        "security-lock-item",
        {
            description: "Lock a Sitecore item.",
            inputSchema: {
                id: z.string().optional()
                    .describe("The ID of the item to lock. Supply this or path."),
                path: z.string().optional()
                    .describe("The path of the item to lock (e.g. /sitecore/content/Home). Supply this or id."),
                force: z.boolean().optional()
                    .describe("If set to true, will force the lock even if the item is locked by another user"),
                passThru: z.boolean().optional()
                    .describe("If set to true, passes the processed object back to the pipeline"),
                database: z.string().optional()
                    .describe("The database containing the item (defaults to the context database)")
            },
        },
        async (params) => {
            const invalid = requireOneTarget(params, ["id", "path"]);
            if (invalid) {
                return invalid;
            }

            const command = `Lock-Item`;
            const options: Record<string, any> = {
                ...(params.id ? { "Id": params.id } : { "Path": params.path }),
            };

            if (params.force) {
                options["Force"] = "";
            }

            if (params.passThru) {
                options["PassThru"] = "";
            }

            if (params.database) {
                options["Database"] = params.database;
            }

            return safeMcpResponse(runGenericPowershellCommand(config, command, options));
        }
    );
}
