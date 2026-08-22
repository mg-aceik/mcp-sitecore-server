import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { requireOneTarget } from "@/tools/target-input.js";
import { runGenericPowershellCommand } from "../generic.js";
import { getSwitchParameterValue } from "../../utils.js";

export function getPlaceholderSettingPowershellTool(server: McpServer, config: Config) {
    server.registerTool(
        "presentation-get-placeholder-setting",
        {
            description: "Gets placeholder setting assigned on an item.",
            inputSchema: {
                id: z.string().optional()
                    .describe("The id of the item to get placeholder setting for. Supply this or path."),
                path: z.string().optional()
                    .describe("The path of the item to get placeholder setting for. Supply this or id."),
                database: z.string()
                    .describe("The content database. Only sent when addressing by id -- a path carries its own database prefix (e.g. master:/sitecore/content/Home).")
                    .optional().default("master"),
                key: z.string().describe("The key filter.").optional(),
                uniqueId: z.string().describe("The placeholder setting unique id.").optional(),
                language: z.string().describe("The language version of the item to retrieve placeholder setting for.").optional(),
                finalLayout: z
                    .boolean()
                    .describe("Specifies layout holding the placeholder setting. If 'true', the final layout is used, otherwise - shared layout.")
                    .optional(),
            },
        },
        async (params) => {
            const invalid = requireOneTarget(params, ["id", "path"]);
            if (invalid) {
                return invalid;
            }

            const command = `Get-PlaceholderSetting`;
            const options: Record<string, any> = {};

            // Each branch sends exactly what its own tool sent: the ID form took a database,
            // the path form never did.
            if (params.id) {
                options["Id"] = params.id;
                options["Database"] = params.database;
            } else {
                options["Path"] = params.path;
            }

            options["Key"] = params.key;
            options["UniqueId"] = params.uniqueId;
            options["Language"] = params.language;
            options["FinalLayout"] = getSwitchParameterValue(params.finalLayout);

            return safeMcpResponse(runGenericPowershellCommand(config, command, options));
        }
    );
}
