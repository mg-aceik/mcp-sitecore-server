import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "@/config.js";
import { z } from "zod";
import { getItemById } from "../../logic/simple/get-item.js";
import { getItemByPath } from "../../logic/simple/get-item-by-path.js";
import { safeMcpResponse } from "@/helper.js";
import { requireOneTarget } from "@/tools/target-input.js";

export function getItemTool(server: McpServer, config: Config) {
    server.registerTool(
        'item-service-get-item',
        {
            description: "Get a Sitecore item by its ID or path.",
            inputSchema: {
                id: z.string().optional().describe("The ID of the item. Supply this or path."),
                path: z.string().optional().describe("The path of the item. Supply this or id."),
                options: z.object({
                    database: z.string().optional(),
                    language: z.string().optional(),
                    version: z.string().optional(),
                    includeStandardTemplateFields: z.boolean().optional(),
                    includeMetadata: z.boolean().optional(),
                    fields: z.array(z.string()).optional(),
                }).optional(),
            },
        },
        async (params) => {
            const invalid = requireOneTarget(params, ["id", "path"]);
            if (invalid) {
                return invalid;
            }

            // Two Item Service endpoints, one per address: an ID reads /items('{...}') and a
            // path reads /items?path=... So the branch picks the request, not just a parameter.
            return safeMcpResponse(params.id
                ? getItemById(config, params.id, params.options || {})
                : getItemByPath(config, params.path!, params.options || {}));
        }
    );
}
