import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { runGenericPowershellCommand } from "../generic.js";
import { DATABASE_PROJECTION, fixedProjectionPipeline, fullOnlyInputSchema } from "../../projection.js";

export function getDatabasePowerShellTool(server: McpServer, config: Config) {
    server.registerTool(
        "common-get-database",
        {
            description: "Gets information about Sitecore databases.",
            inputSchema: z.object({
                name: z.string().optional()
                    .describe("The name of the database to retrieve (e.g. 'master', 'core', 'web'). If not provided, all databases will be returned."),
                ...fullOnlyInputSchema
            }),
        },
        async (params) => {
            const options: Record<string, any> = {};
            const command = `Get-Database`;

            if (params.name) {
                options["Name"] = params.name;
            }

            // Unprojected, Get-Database expands Caches, Engines, DataManager and
            // Templates inline: 8,258 characters for one database, 21,761 for all of them.
            const pipeline = fixedProjectionPipeline(DATABASE_PROJECTION, params);

            return safeMcpResponse(
                runGenericPowershellCommand(config, command, options, undefined, {
                    pipeline,
                    full: params.full,
                })
            );
        }
    );
}