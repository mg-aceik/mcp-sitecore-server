import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { runGenericPowershellCommand } from "../generic.js";
import { itemProjectionInputSchema, itemProjectionPipeline } from "../../projection.js";

export function getItemTemplateByIdPowerShellTool(server: McpServer, config: Config) {
    server.registerTool(
        "common-get-item-template-by-id",
        {
            description: "Gets template information for a Sitecore item by its ID.",
            inputSchema: {
                ...itemProjectionInputSchema,
                id: z.string()
                    .describe("The ID of the item to retrieve template information for."),
                database: z.string().optional()
                    .describe("The database containing the item (defaults to the context database).")
            },
        },
        async (params) => {
            const options: Record<string, any> = {
                "Id": params.id
            };
            const command = `Get-ItemTemplate`;

            if (params.database) {
                options["Database"] = params.database;
            }

            return safeMcpResponse(runGenericPowershellCommand(config, command, options, undefined, {
                full: params.full,
                pipeline: itemProjectionPipeline(params),
            }));
        }
    );
}
