import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { hasTarget, requireOneTarget } from "@/tools/target-input.js";
import { runGenericPowershellCommand } from "../generic.js";

export function unprotectItemPowerShellTool(server: McpServer, config: Config) {
    server.registerTool(
        "security-unprotect-item",
        {
            description: "Unprotect a Sitecore item.",
            inputSchema: z.object({
                id: z.string().optional()
                    .describe("The ID of the item to unprotect. Supply this or path."),
                path: z.string().optional()
                    .describe("The path of the item to unprotect (e.g. /sitecore/content/Home). Supply this or id."),
                passThru: z.boolean().optional()
                    .describe("If set to true, passes the processed object back to the pipeline"),
                database: z.string().optional()
                    .describe("The database containing the item (defaults to the context database)")
            }),
        },
        async (params) => {
            const invalid = requireOneTarget(params, ["id", "path"]);
            if (invalid) {
                return invalid;
            }

            const command = `Unprotect-Item`;
            const options: Record<string, any> = {
                ...(hasTarget(params.id) ? { "Id": params.id } : { "Path": params.path }),
            };

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
