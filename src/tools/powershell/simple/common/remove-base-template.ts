import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { requireOneTarget } from "@/tools/target-input.js";
import { runGenericPowershellCommand } from "../generic.js";

export function removeBaseTemplatePowerShellTool(server: McpServer, config: Config) {
    server.registerTool(
        "common-remove-base-template",
        {
            description: "Removes a base template from a template item.",
            inputSchema: z.object({
                id: z.string().optional()
                    .describe("The ID of the item to remove the base template from. Supply this or path."),
                path: z.string().optional()
                    .describe("The path of the item to remove the base template from. Supply this or id."),
                template: z.string()
                    .describe("The path representing the template item to remove as a base template."),
                database: z.string().optional()
                    .describe("The database containing the item (defaults to the context database).")
            }),
        },
        async (params) => {
            const invalid = requireOneTarget(params, ["id", "path"]);
            if (invalid) {
                return invalid;
            }

            const options: Record<string, any> = {
                ...(params.id ? { "Id": params.id } : { "Path": params.path }),
                "Template": params.template,
            };
            const command = `Remove-BaseTemplate`;

            if (params.database) {
                options["Database"] = params.database;
            }

            return safeMcpResponse(runGenericPowershellCommand(config, command, options));
        }
    );
}
