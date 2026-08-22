import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { requireOneTarget } from "@/tools/target-input.js";
import { runGenericPowershellCommand } from "../generic.js";
import { getSwitchParameterValue } from "../../utils.js";

export function removeRenderingPowershellTool(server: McpServer, config: Config) {
    server.registerTool(
        "presentation-remove-rendering",
        {
            description: "Removes renderings from an item.",
            inputSchema: {
                id: z.string().optional()
                    .describe("The ID of the item to remove rendering from. Supply this or path."),
                path: z.string().optional()
                    .describe("The path of the item to remove rendering from. Supply this or id."),
                uniqueId: z.string().describe("The rendering definition unique id."),
                database: z.string()
                    .describe("The database of the item to remove rendering from. Only sent when addressing by id -- a path carries its own database prefix (e.g. master:/sitecore/content/Home).")
                    .optional(),
                dataSource: z.string().describe("The rendering data source filter.").optional(),
                placeholder: z.string().describe("The rendering placeholder filter.").optional(),
                language: z.string().describe("The item language filter.").optional(),
                finalLayout: z.boolean()
                    .describe("Specifies layout holding the rendering definition. If 'true', the final layout is used, otherwise - shared layout.")
                    .optional(),
            },
        },
        async (params) => {
            const invalid = requireOneTarget(params, ["id", "path"]);
            if (invalid) {
                return invalid;
            }

            const command = `Remove-Rendering`;

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
            options["DataSource"] = params.dataSource;
            options["Placeholder"] = params.placeholder;
            options["Language"] = params.language;
            options["FinalLayout"] = getSwitchParameterValue(params.finalLayout);

            return safeMcpResponse(runGenericPowershellCommand(config, command, options));
        }
    );
}
