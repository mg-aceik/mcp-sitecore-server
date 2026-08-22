import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { requireOneTarget } from "@/tools/target-input.js";
import { runGenericPowershellCommand } from "../../simple/generic.js";
import { PowershellCommandBuilder } from "../../command-builder.js";
import { getSwitchParameterValue, getNumberParameterValue } from "../../utils.js";
import { renderingLookupGuard, renderingNotFoundMessage } from "./rendering-guard.js";
import {
    itemTargetDescription,
    itemTargetParameters,
    renderingItemTargetInputSchema,
} from "./item-target.js";

export function setRenderingPowershellTool(server: McpServer, config: Config) {
    server.registerTool(
        "presentation-set-rendering",
        {
            description: "Updates a rendering placed on an item with new values.",
            inputSchema: {
                ...renderingItemTargetInputSchema,
                uniqueId: z.string().describe("The unique ID of the rendering."),
                placeholder: z.string().describe("New rendering placeholder value if specified.").optional(),
                dataSource: z.string().describe("New rendering data source if specified.").optional(),
                finalLayout: z
                    .boolean()
                    .describe("Specifies the layout to update the rendering. If 'true', the final layout is used, otherwise - shared layout.")
                    .optional(),
                language: z.string().describe("The language version of the item holding the rendering.").optional(),
                index: z.number().describe("New index of the rendering in the layout.").optional(),
                parameter: z.record(z.string(), z.string()).describe("New rendering parameters if specified.").optional(),
            },
        },
        async (params) => {
            const invalid = requireOneTarget(params, ["id", "path"]);
            if (invalid) {
                return invalid;
            }

            const commandBuilder = new PowershellCommandBuilder();

            const getRenderingParameters: Record<string, any> = {};

            // The ID form ordered these -Id, -UniqueId, -Database; the path form sent no
            // database at all. itemTargetParameters keeps each branch as it was.
            if (params.id) {
                getRenderingParameters["Id"] = params.id;
                getRenderingParameters["UniqueId"] = params.uniqueId;
                getRenderingParameters["Database"] = params.database;
            } else {
                getRenderingParameters["Path"] = params.path;
                getRenderingParameters["UniqueId"] = params.uniqueId;
            }

            const setRenderingParameters: Record<string, any> = {
                ...itemTargetParameters(params),
            };
            setRenderingParameters["Placeholder"] = params.placeholder;
            setRenderingParameters["DataSource"] = params.dataSource;
            setRenderingParameters["FinalLayout"] = getSwitchParameterValue(params.finalLayout);
            setRenderingParameters["Language"] = params.language;
            setRenderingParameters["Index"] = getNumberParameterValue(params.index);
            setRenderingParameters["Parameter"] = params.parameter;

            const notFound = renderingNotFoundMessage(
                `a rendering with unique ID '${params.uniqueId}' on ${itemTargetDescription(params)}`,
                "presentation-get-rendering"
            );

            const command = `
                $rendering = Get-Rendering ${commandBuilder.buildParametersString(getRenderingParameters)};
                ${renderingLookupGuard("$rendering", notFound)}
                Set-Rendering -Instance $rendering ${commandBuilder.buildParametersString(setRenderingParameters)};
            `;

            return safeMcpResponse(runGenericPowershellCommand(config, command, {}));
        }
    );
}
