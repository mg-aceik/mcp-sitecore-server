import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { runAuthoringOperation } from "../logic/run.js";

/**
 * Index-backed search over the Authoring and Management API.
 *
 * The criteria model is Sitecore's own: a list of `{ field, value, criteriaType, operator }`
 * entries combined by `SHOULD` (any), `MUST` (all) or `NOT`. The system fields are the
 * useful ones — `_name`, `_fullpath`, `_path`, `_template`, `_templatename`, `_group` —
 * and `_path` matches on an ancestor's ID, which is how you scope a search to a subtree.
 */

const CRITERIA_TYPES = [
    "EXACT", "STARTSWITH", "CONTAINS", "ENDSWITH", "WILDCARD",
    "SEARCH", "RANGE", "FUZZY", "PROXIMITY", "REGEXP",
] as const;

const OPERATORS = ["SHOULD", "MUST", "NOT"] as const;

export function authoringSearchTool(server: McpServer, config: Config) {
    server.registerTool(
        "authoring-search",
        {
            description:
                "Searches a Sitecore index over the Authoring and Management API and returns matching "
                + "items. Criteria combine on the operator you give each one: MUST is AND, SHOULD is "
                + "OR, NOT excludes. Useful system fields: '_name', '_fullpath' (the item path), "
                + "'_path' (matches items under an ancestor, given that ancestor's ID with no braces "
                + "or dashes), '_template' and '_templatename'. IDs in index values are lowercase and "
                + "unpunctuated, e.g. '110d559fdea542ea9c1c8a5df7e70ef9'. Returns 10 results unless "
                + "pageSize says otherwise. A '_path' criterion is the cheap way to read a whole "
                + "subtree at any depth — one query where item-service-get-item-descendants makes "
                + "one request per node — at the cost of returning identity fields rather than "
                + "field values, from the index rather than the database.",
            inputSchema: z.object({
                index: z.string().optional().default("sitecore_master_index")
                    .describe("The index to search. Defaults to sitecore_master_index (the authoring content)."),
                criteria: z.array(z.object({
                    field: z.string().describe("The indexed field name, e.g. 'Title', '_name' or '_templatename'."),
                    value: z.string().describe("The value to match."),
                    criteriaType: z.enum(CRITERIA_TYPES).optional()
                        .describe("How to match. EXACT is the default; SEARCH is full-text; CONTAINS/STARTSWITH/ENDSWITH/WILDCARD/REGEXP match on shape."),
                    operator: z.enum(OPERATORS).optional()
                        .describe("How this criterion combines with the others: MUST (and), SHOULD (or, the default), NOT (exclude)."),
                    boost: z.number().optional().describe("Relevance boost for this criterion."),
                })).min(1).describe("The criteria to match. At least one."),
                language: z.string().optional().describe("Restrict results to this language, e.g. 'en'."),
                latestVersionOnly: z.boolean().optional()
                    .describe("When true, return only the latest version of each item instead of every indexed version."),
                sortField: z.string().optional()
                    .describe("Field to sort by, e.g. '__smallcreateddate'. Omit for relevance order."),
                sortDirection: z.enum(["ASCENDING", "DESCENDING"]).optional()
                    .describe("Sort direction. Only meaningful with sortField."),
                pageSize: z.number().int().positive().optional()
                    .describe("Results per page. The endpoint's own default is 10."),
                pageIndex: z.number().int().min(0).optional()
                    .describe("Zero-based page to return. Use with pageSize to walk a large result set."),
            }),
        },
        (params) => {
            const query = `
                query Search($query: SearchQueryInput!) {
                  search(query: $query) {
                    totalCount
                    results {
                      itemId
                      name
                      path
                      templateName
                      language { name }
                      version
                      updatedDate
                      updatedBy
                    }
                  }
                }`;

            // Paging and sort are only sent when asked for: an empty `paging` object would
            // override the endpoint's defaults with nulls rather than leaving them alone.
            const paging = params.pageSize !== undefined || params.pageIndex !== undefined
                ? { pageSize: params.pageSize, pageIndex: params.pageIndex }
                : undefined;
            const sort = params.sortField !== undefined
                ? [{ field: params.sortField, direction: params.sortDirection }]
                : undefined;

            return safeMcpResponse(runAuthoringOperation(config, query, {
                query: {
                    index: params.index,
                    language: params.language,
                    latestVersionOnly: params.latestVersionOnly,
                    searchStatement: { criteria: params.criteria },
                    paging,
                    sort,
                },
            }));
        }
    );
}
