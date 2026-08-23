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

export function setRenderingParameterPowershellTool(server: McpServer, config: Config) {
    server.registerTool(
        "presentation-set-rendering-parameter",
        {
            description: "Adds and updates the specified rendering parameter from the rendering placed on an item.",
            inputSchema: z.object({
                ...renderingItemTargetInputSchema,
                renderingUniqueId: z.string().describe("The unique ID of the rendering holding the rendering parameter."),
                parameter: z.record(z.string(), z.string()).describe("The rendering parameter to add or update."),
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

            const setRenderingParameterParameters: Record<string, any> = {};
            setRenderingParameterParameters["Parameter"] = params.parameter;

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
                Set-RenderingParameter -Instance $rendering ${commandBuilder.buildParametersString(setRenderingParameterParameters)} |
                    Set-Rendering ${commandBuilder.buildParametersString(setRenderingParameters)}
            `;

            return safeMcpResponse(runGenericPowershellCommand(config, command, {}));
        }
    );
}
