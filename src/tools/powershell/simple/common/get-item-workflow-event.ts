import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { hasTarget, requireOneTarget } from "@/tools/target-input.js";
import { runGenericPowershellCommand } from "../generic.js";

export function getItemWorkflowEventPowerShellTool(server: McpServer, config: Config) {
    server.registerTool(
        "common-get-item-workflow-event",
        {
            description: "Gets entries from the workflow history for the specified item.",
            inputSchema: z.object({
                id: z.string().optional()
                    .describe("The ID of the item to have its history items returned. Supply this or path."),
                path: z.string().optional()
                    .describe("The path of the item to have its history items returned. Supply this or id."),
                identity : z.string().optional()
                    .describe("The user that has been associated with the enteries. Wildcards are supported."),
                language: z.string().optional()
                    .describe("The language that will be used as source language."),
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
            };
            const command = `Get-ItemWorkflowEvent`;

            if (params.identity) {
                options["Identity"] = params.identity;
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
