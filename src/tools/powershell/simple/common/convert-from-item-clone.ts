import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { hasTarget, requireOneTarget } from "@/tools/target-input.js";
import { runGenericPowershellCommand } from "../generic.js";
import { itemProjectionPipeline, itemProjectionInputSchema } from "../../projection.js";
import { ITEM_DATABASE_DESCRIPTION, getSwitchParameterValue } from "../../utils.js";

export function convertFromItemClonePowerShellTool(server: McpServer, config: Config) {
    server.registerTool(
        "common-convert-from-item-clone",
        {
            description: "Converts an item from a clone to a fully independent item.",
            inputSchema: z.object({
                id: z.string().optional()
                    .describe("The ID of the item to be analysed for clones presence. Supply this or path."),
                path: z.string().optional()
                    .describe("The path of the item to be analysed for clones presence. Supply this or id."),
                recurse: z.boolean().optional()
                    .describe("Converts the whole branch rather than a single item."),
                passThru : z.boolean().optional()
                    .describe("Returns the item that was converted from a clone."),
                database: z.string().optional()
                    .describe(ITEM_DATABASE_DESCRIPTION),
                ...itemProjectionInputSchema
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
            const command = `ConvertFrom-ItemClone`;

            if (params.recurse) {
                options["Recurse"] = getSwitchParameterValue(params.recurse);
            }

            if (params.passThru) {
                options["PassThru"] = getSwitchParameterValue(params.passThru);
            }

            if (params.database) {
                options["Database"] = params.database;
            }

            // PassThru returns a Sitecore Item, whose unprojected graph measured over
            // 50,000 characters for a single content page.
            const pipeline = params.passThru ? itemProjectionPipeline(params) : undefined;

            return safeMcpResponse(
                runGenericPowershellCommand(config, command, options, undefined, {
                    pipeline,
                    full: params.full,
                })
            );
        }
    );
}
