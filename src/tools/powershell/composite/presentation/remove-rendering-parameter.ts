import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { requireOneTarget } from "@/tools/target-input.js";
import { runGenericPowershellCommand } from "../../simple/generic.js";
import { PowershellCommandBuilder } from "../../command-builder.js";
import { EFFECTIVE_FINAL_LAYOUT_DESCRIPTION, getFinalLayoutSwitchValue } from "../../utils.js";
import { renderingLookupGuard, renderingNotFoundMessage } from "./rendering-guard.js";
import {
    itemTargetDescription,
    itemTargetParameters,
    renderingItemTargetInputSchema,
} from "./item-target.js";

export function removeRenderingParameterPowershellTool(server: McpServer, config: Config) {
    server.registerTool(
        "presentation-remove-rendering-parameter",
        {
            description: "Removes the specified rendering parameter from the rendering placed on an item.",
            inputSchema: z.object({
                ...renderingItemTargetInputSchema,
                renderingUniqueId: z.string().describe("The unique ID of the rendering holding the rendering parameter."),
                name: z.string().describe("The name of the rendering parameter to remove.").optional(),
                finalLayout: z
                    .boolean()
                    .describe(EFFECTIVE_FINAL_LAYOUT_DESCRIPTION)
                    .optional(),
                language: z.string().describe("The item language varsion.").optional(),
            }),
        },
        async (params) => {
            const invalid = requireOneTarget(params, ["id", "path"]);
            if (invalid) {
                return invalid;
            }

            const commandBuilder = new PowershellCommandBuilder();

            const getRenderingParameters: Record<string, any> = {
                ...itemTargetParameters(params),
            };
            getRenderingParameters["UniqueId"] = params.renderingUniqueId;
            getRenderingParameters["FinalLayout"] = getFinalLayoutSwitchValue(params.finalLayout);
            getRenderingParameters["Language"] = params.language;

            const removeRenderingParameterParameters: Record<string, any> = {};
            removeRenderingParameterParameters["Name"] = params.name;

            const setRenderingParameters: Record<string, any> = {
                ...itemTargetParameters(params),
            };
            setRenderingParameters["FinalLayout"] = getFinalLayoutSwitchValue(params.finalLayout);
            setRenderingParameters["Language"] = params.language;

            const notFound = renderingNotFoundMessage(
                `a rendering with unique ID '${params.renderingUniqueId}' on ${itemTargetDescription(params)}`,
                "presentation-get-rendering"
            );

            const command = `
                $rendering = Get-Rendering ${commandBuilder.buildParametersString(getRenderingParameters)};
                ${renderingLookupGuard("$rendering", notFound)}
                Remove-RenderingParameter -Instance $rendering ${commandBuilder.buildParametersString(removeRenderingParameterParameters)} |
                    Set-Rendering ${commandBuilder.buildParametersString(setRenderingParameters)};
            `;

            return safeMcpResponse(runGenericPowershellCommand(config, command, {}));
        }
    );
}
