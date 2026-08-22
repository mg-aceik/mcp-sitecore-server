import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { requireOneTarget } from "@/tools/target-input.js";
import { runGenericPowershellCommand } from "../generic.js";
import { getSwitchParameterValue } from "../../utils.js";

export function getItemFieldPowerShellTool(server: McpServer, config: Config) {
    server.registerTool(
        "common-get-item-field",
        {
            description: "Gets item fields as either names or fields or template fields.",
            inputSchema: z.object({
                id: z.string().optional()
                    .describe("The ID of the item to retrieve field information for. Supply this or path."),
                path: z.string().optional()
                    .describe("The path of the item to retrieve field information for. Supply this or id."),
                name: z.array(z.string()).optional()
                    .describe("The array of names to include - supports wildcards."),
                includeStandardFields : z.boolean().optional()
                    .describe("Includes fields that are defined on 'Standard template'."),
                returnType : z.enum(["Name", "Field", "TemplateField"]).optional()
                    .describe("Includes fields that are defined on 'Standard template'."),
                language: z.string().optional()
                    .describe("The language that will be analysed."),
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
            };
            const command = `Get-ItemField`;

            if (params.name && params.name.length > 0) {
                options["Name"] = params.name;
            }

            if (params.includeStandardFields) {
                options["IncludeStandardFields"] = getSwitchParameterValue(params.includeStandardFields);
            }

            if (params.returnType) {
                options["ReturnType"] = params.returnType;
            }

            if (params.language) {
                options["Language"] = params.language;
            }

            if (params.database) {
                options["Database"] = params.database;
            }

            return safeMcpResponse(runGenericPowershellCommand(config, command, options));
        }
    );
}
