import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { requireOneTarget } from "@/tools/target-input.js";
import { runGenericPowershellCommand } from "../generic.js";
import { itemProjectionInputSchema, itemProjectionPipeline } from "../../projection.js";
import { getSwitchParameterValue } from "../../utils.js";

export function getLayoutPowershellTool(server: McpServer, config: Config) {
    server.registerTool(
        "presentation-get-layout",
        {
            description: "Gets the layout definition item assigned to an item -- the Sitecore layout item itself (e.g. 'Headless Layout'), not the renderings placed on the page. Use presentation-list-renderings to see a page's components.",
            inputSchema: z.object({
                ...itemProjectionInputSchema,
                id: z.string().optional()
                    .describe("The ID of the item to retrieve layout for. Supply this or path."),
                path: z.string().optional()
                    .describe("The path of the item to retrieve layout for. Supply this or id."),
                finalLayout: z
                    .boolean()
                    .optional()
                    .describe("Specifies layout to be retrieved. If 'true', the final layout is retrieved, otherwise - shared layout."),
                language: z.string()
                    .optional()
                    .describe("Specifies the item language to retrieve layout."),
            }),
        },
        async (params) => {
            const invalid = requireOneTarget(params, ["id", "path"]);
            if (invalid) {
                return invalid;
            }

            const command = `Get-Layout`;
            const options: Record<string, any> = {};

            if (params.id) {
                options["Id"] = params.id;
            } else {
                options["Path"] = params.path;
            }

            options["FinalLayout"] = getSwitchParameterValue(params.finalLayout);
            options["Language"] = params.language;

            return safeMcpResponse(runGenericPowershellCommand(config, command, options, undefined, {
                full: params.full,
                pipeline: itemProjectionPipeline(params),
            }));
        }
    );
}
