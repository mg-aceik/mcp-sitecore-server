import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { requireOneTarget } from "@/tools/target-input.js";
import { runGenericPowershellCommand } from "../../simple/generic.js";
import { PowershellCommandBuilder } from "../../command-builder.js";
import { getSwitchParameterValue } from "../../utils.js";
import { renderingLookupGuard, renderingNotFoundMessage } from "./rendering-guard.js";
import {
    itemTargetDescription,
    itemTargetParameters,
    renderingItemTargetInputSchema,
} from "./item-target.js";

export function getRenderingParameterPowershellTool(server: McpServer, config: Config) {
    server.registerTool(
        "presentation-get-rendering-parameter",
        {
            description: "Gets rendering parameter for a rendering placed on an item.",
            inputSchema: z.object({
                ...renderingItemTargetInputSchema,
                renderingUniqueId: z.string().describe("The unique ID of the rendering holding the rendering parameter."),
                name: z.string().describe("The name of the rendering parameter to get.").optional(),
                finalLayout: z
                    .boolean()
                    .describe("Specifies layout holding the rendering parameter. If 'true', the final layout is used, otherwise - shared layout.")
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
            getRenderingParameters["FinalLayout"] = getSwitchParameterValue(params.finalLayout);
            getRenderingParameters["Language"] = params.language;

            const getRenderingParameterParameters: Record<string, any> = {};
            getRenderingParameterParameters["Name"] = params.name;

            const notFound = renderingNotFoundMessage(
                `a rendering with unique ID '${params.renderingUniqueId}' on ${itemTargetDescription(params)}`,
                "presentation-get-rendering"
            );

            const command = `
                $rendering = Get-Rendering ${commandBuilder.buildParametersString(getRenderingParameters)};
                ${renderingLookupGuard("$rendering", notFound)}
                Get-RenderingParameter -Instance $rendering ${commandBuilder.buildParametersString(getRenderingParameterParameters)};
            `;

            return safeMcpResponse(runGenericPowershellCommand(config, command, {}));
        }
    );
}
