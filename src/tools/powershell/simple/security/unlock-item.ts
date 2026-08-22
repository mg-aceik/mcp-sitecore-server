import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { requireOneTarget } from "@/tools/target-input.js";
import { runGenericPowershellCommand } from "../generic.js";

export function unlockItemPowerShellTool(server: McpServer, config: Config) {
    server.registerTool(
        "security-unlock-item",
        {
            description: "Unlocks a Sitecore item.",
            inputSchema: z.object({
                id: z.string().optional()
                    .describe("The ID of the item to unlock. Supply this or path."),
                path: z.string().optional()
                    .describe("The path to the item to unlock. Supply this or id."),
                force: z.boolean().optional().describe("When specified the item is unlocked regardless of the owner"),
                passThru: z.boolean().optional().describe("When specified returns the item to the pipeline"),
                database: z.string().optional().describe("The database containing the item"),
            }),
        },
        async (params) => {
            const invalid = requireOneTarget(params, ["id", "path"]);
            if (invalid) {
                return invalid;
            }

            const command = `Unlock-Item`;
            const options: Record<string, any> = {
                ...(params.id ? { "ID": params.id } : { "Path": params.path }),
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
