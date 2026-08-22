import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { requireOneTarget } from "@/tools/target-input.js";
import { runGenericPowershellCommand } from "../../simple/generic.js";
import { PowershellCommandBuilder } from "../../command-builder.js";
import { getSwitchParameterValue } from "../../utils.js";

export function addPlaceholderSettingPowershellTool(server: McpServer, config: Config) {
    server.registerTool(
        "presentation-add-placeholder-setting",
        {
            description: "Adds a placeholder setting to an item.",
            inputSchema: {
                id: z.string().optional()
                    .describe("The ID of the item to add the placeholder setting to. Supply this or path."),
                path: z.string().optional()
                    .describe("The path of the item to add the placeholder setting to. Supply this or id."),
                placeholderSettingId: z.string().optional()
                    .describe("The ID of the placeholder setting to add. Supply this or placeholderSettingPath."),
                placeholderSettingPath: z.string().optional()
                    .describe("The path of the placeholder setting to add. Supply this or placeholderSettingId."),
                key: z.string().describe("The key of the placeholder setting to add."),
                database: z.string()
                    .describe("The context database. Sent when addressing the item or the placeholder setting by ID -- a path carries its own database prefix (e.g. master:/sitecore/content/Home).")
                    .optional().default("master"),
                finalLayout: z
                    .boolean()
                    .describe("Specifies layout to add the rendering placeholder setting to. If 'true', the final layout is used, otherwise - shared layout.")
                    .optional(),
                language: z.string().describe("The language version of the item to add the placeholder setting to.").optional(),
            },
        },
        async (params) => {
            // Two independent targets here: the item that gets the setting, and the
            // placeholder setting itself. Each was fixed by the tool name before the merge.
            const invalidItem = requireOneTarget(params, ["id", "path"]);
            if (invalidItem) {
                return invalidItem;
            }

            const invalidSetting = requireOneTarget(params, ["placeholderSettingId", "placeholderSettingPath"]);
            if (invalidSetting) {
                return invalidSetting;
            }

            const commandBuilder = new PowershellCommandBuilder();
            const createPlaceholderSettingParameters: Record<string, any> = {};

            if (params.placeholderSettingId) {
                createPlaceholderSettingParameters["Id"] = params.placeholderSettingId;
                createPlaceholderSettingParameters["Database"] = params.database;
            } else {
                createPlaceholderSettingParameters["Path"] = params.placeholderSettingPath;
            }

            const addPlaceholderSettingParameters: Record<string, any> = {};

            if (params.id) {
                addPlaceholderSettingParameters["Id"] = params.id;
                addPlaceholderSettingParameters["Key"] = params.key;
                addPlaceholderSettingParameters["Database"] = params.database;
            } else {
                addPlaceholderSettingParameters["Path"] = params.path;
                addPlaceholderSettingParameters["Key"] = params.key;
            }

            addPlaceholderSettingParameters["FinalLayout"] = getSwitchParameterValue(params.finalLayout);
            addPlaceholderSettingParameters["Language"] = params.language;

            const command = `
                $placeholderSetting = New-PlaceholderSetting ${commandBuilder.buildParametersString(createPlaceholderSettingParameters)}
                Add-PlaceholderSetting -Instance $placeholderSetting ${commandBuilder.buildParametersString(addPlaceholderSettingParameters)}
            `;

            return safeMcpResponse(runGenericPowershellCommand(config, command, {}));
        }
    );
}
