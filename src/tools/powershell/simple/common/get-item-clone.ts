import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { hasTarget, requireOneTarget } from "@/tools/target-input.js";
import { runGenericPowershellCommand } from "../generic.js";
import { itemProjectionInputSchema, itemProjectionPipeline } from "../../projection.js";
import { ITEM_DATABASE_DESCRIPTION } from "../../utils.js";

export function getItemClonePowerShellTool(server: McpServer, config: Config) {
    server.registerTool(
        "common-get-item-clone",
        {
            description: "Returns all the clones for the specified item.",
            inputSchema: z.object({
                ...itemProjectionInputSchema,
                id: z.string().optional()
                    .describe("The ID of the item to be analysed for clones presence. Supply this or path."),
                path: z.string().optional()
                    .describe("The path of the item to be analysed for clones presence. Supply this or id."),
                database: z.string().optional()
                    .describe(ITEM_DATABASE_DESCRIPTION)
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
            const command = `Get-ItemClone`;

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
