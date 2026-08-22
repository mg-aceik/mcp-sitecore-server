import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { requireOneTarget } from "@/tools/target-input.js";
import { runGenericPowershellCommand } from "../generic.js";

export function setItemTemplatePowerShellTool(server: McpServer, config: Config) {
    server.registerTool(
        "common-set-item-template",
        {
            description: "Sets the item template.",
            inputSchema: z.object({
                id: z.string().optional()
                    .describe("The ID of the item to set the template for. Supply this or path."),
                path: z.string().optional()
                    .describe("The path of the item to set the template for. Supply this or id."),
                template: z.string()
                    .describe("The path representing the template item."),
                fieldsToCopy: z.record(z.string(), z.string()).optional()
                    .describe("The key-value pairs map the old template fields to the new template fields. The key represents the old template field, and the value represents the new template field."),
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
            const command = `Set-ItemTemplate`;

            if (params.fieldsToCopy) {
                options["FieldsToCopy"] = params.fieldsToCopy;
            }

            if (params.database) {
                options["Database"] = params.database;
            }

            return safeMcpResponse(runGenericPowershellCommand(config, command, options));
        }
    );
}
