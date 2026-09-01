import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { searchItems } from "../../logic/simple/search-items.js";
import { safeMcpResponse } from "@/helper.js";

export function searchItemsTool(server: McpServer, config: Config) {
    server.registerTool(
        'item-service-search-items',
        {
            description:
                "Search Sitecore items using the ItemService RESTful API. The endpoint's facet "
                + "breakdown is omitted unless includeFacets is set — it accounted for 96% of the "
                + "response on a live CM and is rarely what the caller is after.",
            inputSchema: z.object({
                term: z.string().min(1).describe("The text to search for."),
                fields: z.array(z.string()).optional()
                    .describe("Restrict each result to these fields. Strongly recommended: a full result carries every field of the item."),
                facet: z.string().optional()
                    .describe("Filter the results by a facet, as 'name|value' (e.g. '_language|en')."),
                page: z.number().int().min(0).optional().describe("Zero-based page to return."),
                pageSize: z.number().int().min(1).max(1000).optional().describe("Results per page."),
                database: z.string().optional().describe("The database to search. Defaults to master."),
                includeStandardTemplateFields: z.boolean().optional()
                    .describe("Include the Standard template's fields. Off by default; a large addition to every result."),
                includeFacets: z.boolean().optional()
                    .describe("Include the facet breakdown (names and counts). Off by default: it dominated the payload, 96% of a live one-result search."),
            }),
        },
        async (params) => {
            return safeMcpResponse(searchItems(config, params));
        }
    );
}
