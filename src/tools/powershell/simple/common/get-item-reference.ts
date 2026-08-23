import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { hasTarget, requireOneTarget } from "@/tools/target-input.js";
import { runGenericPowershellCommand } from "../generic.js";
import { itemProjectionInputSchema, itemProjectionPipeline } from "../../projection.js";

export function getItemReferencePowerShellTool(server: McpServer, config: Config) {
    server.registerTool(
        "common-get-item-reference",
        {
            description: "Gets item references for a Sitecore item, showing where it is used throughout the system.",
            inputSchema: z.object({
                ...itemProjectionInputSchema,
                id: z.string().optional()
                    .describe("The ID of the item to retrieve references for. Supply this or path."),
                path: z.string().optional()
                    .describe("The path of the item to retrieve references for (e.g. /sitecore/content/Home). Supply this or id."),
                database: z.string().optional()
                    .describe("The database containing the item (defaults to the context database)"),
                language: z.string().optional()
                    .describe("The language of the item to check references for"),
                version: z.string().optional()
                    .describe("The version of the item to check references for"),
            }),
        },
        async (params) => {
            const invalid = requireOneTarget(params, ["id", "path"]);
            if (invalid) {
                return invalid;
            }

            const command = `Get-ItemReference`;
            const options: Record<string, any> = {
                ...(hasTarget(params.id) ? { "ID": params.id } : { "Path": params.path }),
            };

            if (params.database) {
                options["Database"] = params.database;
            }

            if (params.language) {
                options["Language"] = params.language;
            }

            if (params.version) {
                options["Version"] = params.version;
            }

            return safeMcpResponse(runGenericPowershellCommand(config, command, options, undefined, {
                full: params.full,
                pipeline: itemProjectionPipeline(params),
            }));
        }
    );
}
