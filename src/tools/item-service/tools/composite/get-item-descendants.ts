import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { getItemDescendants } from "../../logic/composite/get-item-descendants.js";
import { safeMcpResponse } from "@/helper.js";

export function getItemDescendantsTool(server: McpServer, config: Config) {
    server.registerTool(
        'item-service-get-item-descendants',
        {
            // The cost is the thing a caller needs to know here and cannot see: this is a
            // client-side walk, not a server-side query, so it scales with the size of the
            // subtree in round trips rather than in bytes. Saying so at the point of choice
            // is worth more than any amount of documentation elsewhere.
            description:
                "Gets every descendant of a Sitecore item by ID, with all their fields. Walks the "
                + "tree client-side: one request per node, issued sequentially, so a large subtree "
                + "costs seconds to minutes and returns an unpaged result. For structure only "
                + "(paths, names, templates) at any depth, authoring-search with a '_path' "
                + "criterion is one indexed query instead. Truncates at DESCENDANTS_MAX_ITEMS "
                + "(5000) and says so. See the guide://tool-selection resource.",
            inputSchema: z.object({
                id: z.string(),
                options: z.object({
                    database: z.string().optional(),
                    language: z.string().optional(),
                    version: z.string().optional(),
                    includeStandardTemplateFields: z.boolean().optional(),
                    includeMetadata: z.boolean().optional(),
                    fields: z.array(z.string()).optional()
                        .describe("Return only these fields on each item. Set it whenever you know what you need — a full item carries every field of its template, roughly 1.9KB each."),
                }).optional(),
            }),
        },
        async (params) => {
            return safeMcpResponse(getItemDescendants(config, params.id, params.options || {}));
        }
    );
}
