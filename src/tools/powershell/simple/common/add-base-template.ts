import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { requireOneTarget } from "@/tools/target-input.js";
import { runGenericPowershellCommand } from "../generic.js";

export function addBaseTemplatePowerShellTool(server: McpServer, config: Config) {
    server.registerTool(
        "common-add-base-template",
        {
            description: "Adds a base template to a template item.",
            inputSchema: {
                id: z.string().optional()
                    .describe("The ID of the item to add the base template to. Supply this or path."),
                path: z.string().optional()
                    .describe("The path of the item to add the base template to. Supply this or id."),
                template: z.string()
                    .describe("The path representing the template item to add as a base template."),
                database: z.string().optional()
                    .describe("The database containing the item (defaults to the context database).")
            },
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
            const command = `Add-BaseTemplate`;

            if (params.database) {
                options["Database"] = params.database;
            }

            return safeMcpResponse(runGenericPowershellCommand(config, command, options));
        }
    );
}
