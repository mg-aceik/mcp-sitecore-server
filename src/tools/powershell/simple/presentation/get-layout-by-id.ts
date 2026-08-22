import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { runGenericPowershellCommand } from "../generic.js";
import { itemProjectionInputSchema, itemProjectionPipeline } from "../../projection.js";
import { getSwitchParameterValue } from "../../utils.js";

export function getLayoutByIdPowershellTool(server: McpServer, config: Config) {
    server.registerTool(
        "presentation-get-layout-by-id",
        {
            description: "Gets the layout definition item assigned to the item with this ID -- the Sitecore layout item itself (e.g. 'Headless Layout'), not the renderings placed on the page. Use presentation-list-renderings-by-id to see a page's components.",
            inputSchema: {
                ...itemProjectionInputSchema,
                id: z.string().describe("The ID of the item to retrieve layout for."),
                finalLayout: z
                    .boolean()
                    .optional()
                    .describe("Specifies layout to be retrieved. If 'true', the final layout is retrieved, otherwise - shared layout."),
                language: z.string()
                    .optional()
                    .describe("Specifies the item language to retrieve layout."),
            },
        },
        async (params) => {
            const command = `Get-Layout`;
            const options: Record<string, any> = {};

            options["Id"] = params.id;
            options["FinalLayout"] = getSwitchParameterValue(params.finalLayout);
            options["Language"] = params.language;

            return safeMcpResponse(runGenericPowershellCommand(config, command, options, undefined, {
                full: params.full,
                pipeline: itemProjectionPipeline(params),
            }));
        }
    );
};