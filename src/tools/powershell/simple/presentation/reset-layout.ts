import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { requireOneTarget } from "@/tools/target-input.js";
import { runGenericPowershellCommand } from "../generic.js";
import { getSwitchParameterValue } from "../../utils.js";

export function resetLayoutPowershellTool(server: McpServer, config: Config) {
    server.registerTool(
        "presentation-reset-layout",
        {
            description: "Resets the layout of an item.",
            inputSchema: z.object({
                id: z.string().optional()
                    .describe("The ID of the item to reset the layout for. Supply this or path."),
                path: z.string().optional()
                    .describe("The path of the item to reset the layout for. Supply this or id."),
                finalLayout: z.boolean().describe("Specifies layout to be reset. If 'true', the final layout is reset, otherwise - shared layout.").optional(),
                language: z.string().describe("Specifies the item language to reset layout for.").optional(),
            }),
        },
        async (params) => {
            const invalid = requireOneTarget(params, ["id", "path"]);
            if (invalid) {
                return invalid;
            }

            const command = `Reset-Layout`;
            const options: Record<string, any> = {};

            if (params.id) {
                options["Id"] = params.id;
            } else {
                options["Path"] = params.path;
            }

            options["FinalLayout"] = getSwitchParameterValue(params.finalLayout);
            options["Language"] = params.language;

            return safeMcpResponse(runGenericPowershellCommand(config, command, options));
        }
    );
}
