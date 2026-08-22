import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { requireOneTarget } from "@/tools/target-input.js";
import { runGenericPowershellCommand } from "../../simple/generic.js";
import { quotePowerShellString } from "../../command-builder.js";

export function initializeSearchIndexingItemPowerShellTool(server: McpServer, config: Config) {
    server.registerTool(
        "indexing-initialize-search-index-item",
        {
            description: "Rebuilds the index for a given tree with the specified root item and index name. Supports wildcard filtering for the index name.",
            inputSchema: {
                id: z.string().optional()
                    .describe("The ID of the item to rebuild the index for. Supply this or path."),
                path: z.string().optional()
                    .describe("The path of the item to rebuild the index for. Supply this or id."),
                database: z.string()
                    .describe("The database to resolve an id against. Ignored when addressing by path, which carries its own prefix (e.g. master:/sitecore/content/Home).")
                    .optional().default("master"),
                indexName: z.string()
                    .default("sitecore_*_index")
                    .optional()
                    .describe("The name of the index to rebuild"),
            },
        },
        async (params) => {
            const invalid = requireOneTarget(params, ["id", "path"]);
            if (invalid) {
                return invalid;
            }

            // `-Id` needs a database root to resolve against; a path is already qualified.
            const itemLookup = params.id
                ? `Get-Item -Id ${quotePowerShellString(params.id)} -Path ${quotePowerShellString(`${params.database}:`)}`
                : `Get-Item -Path ${quotePowerShellString(params.path)}`;

            const command = `
                $item = ${itemLookup};
                $indexName = ${quotePowerShellString(params.indexName)};
                Initialize-SearchIndexItem -Item $item -Name $indexName
            `.replaceAll(/[\n]+/g, "");

            return safeMcpResponse(runGenericPowershellCommand(config, command, {}));
        }
    );
}
