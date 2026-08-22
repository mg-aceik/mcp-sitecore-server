import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { requireOneTarget } from "@/tools/target-input.js";
import { runGenericPowershellCommand } from "../generic.js";

export function invokeWorkflowPowerShellTool(server: McpServer, config: Config) {
    server.registerTool(
        "common-invoke-workflow",
        {
            description: "Executes workflow action for a Sitecore item.",
            inputSchema: z.object({
                id: z.string().optional()
                    .describe("The ID of the item to have the workflow action executed. Supply this or path."),
                path: z.string().optional()
                    .describe("The path of the item to have the workflow action executed. Supply this or id."),
                commandName: z.string()
                    .describe("The name of the workflow command."),
                comments: z.string().optional()
                    .describe("The comment to be saved in the history table for the action."),
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
                ...(params.id ? { "Id": params.id } : { "Path": params.path }),
                "CommandName": params.commandName,
            };
            const command = `Invoke-Workflow`;

            if (params.comments) {
                options["Comments"] = params.comments;
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
