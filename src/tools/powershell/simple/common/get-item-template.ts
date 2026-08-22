import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { requireOneTarget } from "@/tools/target-input.js";
import { runGenericPowershellCommand } from "../generic.js";
import { itemProjectionInputSchema, itemProjectionPipeline } from "../../projection.js";

export function getItemTemplatePowerShellTool(server: McpServer, config: Config) {
    server.registerTool(
        "common-get-item-template",
        {
            description: "Gets template information for a Sitecore item.",
            inputSchema: z.object({
                ...itemProjectionInputSchema,
                id: z.string().optional()
                    .describe("The ID of the item to retrieve template information for. Supply this or path."),
                path: z.string().optional()
                    .describe("The path of the item to retrieve template information for (e.g. /sitecore/content/Home). Supply this or id."),
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
