import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { requireOneTarget } from "@/tools/target-input.js";
import { runGenericPowershellCommand } from "../../simple/generic.js";
import { PowershellCommandBuilder, quotePowerShellString } from "../../command-builder.js";
import { getSwitchParameterValue, getNumberParameterValue } from "../../utils.js";

export function addRenderingPowershellTool(server: McpServer, config: Config) {
    server.registerTool(
        "presentation-add-rendering",
        {
            description: "Adds a rendering to presentation of an item. Writes whatever it is told: use get-allowed-components-by-placeholder first, or add-rendering-to-placeholder, if the layout has to stay valid.",
            inputSchema: {
                id: z.string().optional()
                    .describe("The ID of the item to add the rendering to. Supply this or path."),
                path: z.string().optional()
                    .describe("The path of the item to add the rendering to. Supply this or id."),
                renderingId: z.string().optional()
                    .describe("The ID of the rendering to add. Supply this or renderingPath."),
                renderingPath: z.string().optional()
                    .describe("The path of the rendering to add. Supply this or renderingId."),
                database: z.string()
                    .describe("The context database. Sent when addressing the item or the rendering by ID -- a path carries its own database prefix (e.g. master:/sitecore/content/Home).")
                    .optional().default("master"),
                placeHolder: z.string().describe("The placeholder to add the rendering to."),
                dataSource: z.string().describe("The rendering data source.").optional(),
                finalLayout: z
                    .boolean()
                    .describe("Specifies layout to add the rendering to. If 'true', the final layout is used, otherwise - shared layout.")
                    .optional(),
                language: z.string().describe("The language version of the item to add the rendering to.").optional(),
                index: z.number().describe("The index at which the Rendering should be inserted.").optional(),
            },
        },
        async (params) => {
            // Two independent targets here: the item that gets the rendering, and the
            // rendering itself. Each was fixed by the tool name before the merge.
            const invalidItem = requireOneTarget(params, ["id", "path"]);
            if (invalidItem) {
                return invalidItem;
            }

            const invalidRendering = requireOneTarget(params, ["renderingId", "renderingPath"]);
            if (invalidRendering) {
                return invalidRendering;
            }

            const commandBuilder = new PowershellCommandBuilder();
            const addRenderingParameters: Record<string, any> = {};

            if (params.id) {
                addRenderingParameters["Id"] = params.id;
            } else {
                addRenderingParameters["Path"] = params.path;
            }

            addRenderingParameters["Placeholder"] = params.placeHolder;
            addRenderingParameters["DataSource"] = params.dataSource;
            addRenderingParameters["FinalLayout"] = getSwitchParameterValue(params.finalLayout);

            if (params.id) {
                addRenderingParameters["Database"] = params.database;
            }

            addRenderingParameters["Language"] = params.language;
            addRenderingParameters["Index"] = getNumberParameterValue(params.index);

            const newRendering = params.renderingId
                ? `New-Rendering -Id ${quotePowerShellString(params.renderingId)} -Database ${quotePowerShellString(params.database)}`
                : `New-Rendering -Path ${quotePowerShellString(params.renderingPath)}`;

            const command = `
                $rendering = ${newRendering};
                Add-Rendering -Instance $rendering ${commandBuilder.buildParametersString(addRenderingParameters)};
            `;

            return safeMcpResponse(runGenericPowershellCommand(config, command, {}));
        }
    );
}
