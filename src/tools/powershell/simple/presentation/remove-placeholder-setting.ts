import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { requireOneTarget } from "@/tools/target-input.js";
import { runGenericPowershellCommand } from "../generic.js";
import { ITEM_DATABASE_DESCRIPTION, getSwitchParameterValue } from "../../utils.js";

export function removePlaceholderSettingPowershellTool(server: McpServer, config: Config) {
    server.registerTool(
        "presentation-remove-placeholder-setting",
        {
            description: "Removes placeholder setting from an item.",
            inputSchema: z.object({
                id: z.string().optional()
                    .describe("The id of the item to remove placeholder settings from. Supply this or path."),
                path: z.string().optional()
                    .describe("The path of the item to remove placeholder settings from. Supply this or id."),
                database: z.string()
                    .describe(ITEM_DATABASE_DESCRIPTION)
                    .optional().default("master"),
                uniqueId: z.string().describe("The placeholder setting unique id to remove.").optional(),
                key: z.string().describe("The placeholder setting key to remove.").optional(),
                finalLayout: z.boolean()
                    .describe("Specifies layout holding the placeholder setting. If 'true', the final layout is used, otherwise - shared layout.")
                    .optional(),
                language: z.string().describe("The item language filter.").optional(),
            }),
        },
        async (params) => {
            const invalid = requireOneTarget(params, ["id", "path"]);
            if (invalid) {
                return invalid;
            }

            const command = `Remove-PlaceholderSetting`;

            const options: Record<string, any> = {};

            // Each branch sends exactly what its own tool sent: the ID form took a database,
            // the path form never did.
            if (params.id) {
                options["Id"] = params.id;
                options["Database"] = params.database;
            } else {
                options["Path"] = params.path;
            }

            options["UniqueId"] = params.uniqueId;
            options["Key"] = params.key;
            options["FinalLayout"] = getSwitchParameterValue(params.finalLayout);
            options["Language"] = params.language;

            return safeMcpResponse(runGenericPowershellCommand(config, command, options));
        }
    );
}
