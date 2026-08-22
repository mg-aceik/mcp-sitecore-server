import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { hasTarget, requireOneTarget } from "@/tools/target-input.js";
import { runGenericPowershellCommand } from "../generic.js";

export function testBaseTemplatePowerShellTool(server: McpServer, config: Config) {
    server.registerTool(
        "common-test-base-template",
        {
            description: "Checks if the item inherits from the specified template.",
            inputSchema: z.object({
                id: z.string().optional()
                    .describe("The ID of the item to сheck template inheritance for. Supply this or path."),
                path: z.string().optional()
                    .describe("The path of the item to сheck template inheritance for. Supply this or id."),
                template: z.string()
                    .describe("The ID or path of the template to be analyzed."),
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
                ...(hasTarget(params.id) ? { "Id": params.id } : { "Path": params.path }),
                "Template": params.template,
            };
            const command = `Test-BaseTemplate`;

            if (params.database) {
                options["Database"] = params.database;
            }

            return safeMcpResponse(runGenericPowershellCommand(config, command, options));
        }
    );
}
