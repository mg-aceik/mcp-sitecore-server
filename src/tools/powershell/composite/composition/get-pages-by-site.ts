import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { runGenericPowershellCommand } from "../../simple/generic.js";
import { quotePowerShellString } from "../../command-builder.js";
import { SITE_SCOPE_FUNCTIONS } from "./site-scope.js";
import {
    MISSING_SITE_SELECTOR,
    SITE_READ_FUNCTIONS,
    siteResolutionScript,
    siteSelectorInputSchema,
} from "./site-reads.js";

/**
 * A site's pages, and the same set filtered by title.
 *
 * `template` and `templateID` are included deliberately. `sitecore-marketer`'s page list
 * returns `{id, path}` only — 22 pages in ~1,300 characters — and the template costs
 * almost nothing while removing a follow-up call per page, whether the caller is deciding
 * what a page is or creating a sibling of one.
 *
 * `limit` bounds the response rather than the search: `matched` is the true count and
 * `truncated` says whether rows were withheld, so a caller reading a large site learns
 * that it is large instead of receiving a response silently cut short.
 */

const ROW_DESCRIPTION =
    "Returns { Matched, Returned, Truncated, Root, SiteName, Pages: [{ ID, Path, Template, "
    + "TemplateID }] }. An item counts as a page when it has presentation (a layout on the "
    + "item or on its template's standard values), which is what makes it addressable as a "
    + "page — not a guess from template naming.";

const LIMIT_DESCRIPTION =
    "Maximum rows to return (default 500). Matched always reports the true count, and "
    + "Truncated says whether rows were withheld.";

const ROOT_PATH_DESCRIPTION =
    "Scan this subtree instead of the site's home item, e.g. to list one section. Must be "
    + "inside the site.";

function pageRowsScript(params: { limit?: number; rootPath?: string; query?: string }): string {
    const limit = params.limit ?? 500;
    const scanRoot = params.rootPath
        ? `
$scanRoot = Get-Item -Path ($siteDatabase + ':' + ${quotePowerShellString(params.rootPath)}) -ErrorAction SilentlyContinue;
if ($null -eq $scanRoot) {
    Write-Error ("No item was found at '" + ${quotePowerShellString(params.rootPath)} + "' in database '" + $siteDatabase + "'.");
    return;
}
`
        : `
$scanRoot = Get-Item -Path ($siteDatabase + ':' + $siteRow.StartPath) -ErrorAction SilentlyContinue;
if ($null -eq $scanRoot) {
    # A site whose start item is missing still has a root, and listing from the root is
    # more useful than refusing.
    $scanRoot = $siteRootItem;
}
`;

    return `${scanRoot}
$result = Get-McpPageRows -Root $scanRoot -Query ${quotePowerShellString(params.query ?? "")} -Limit ${Number(limit)};
[PSCustomObject]@{
    SiteName = $siteRow.Name;
    Root = $scanRoot.Paths.FullPath;
    Matched = $result.Matched;
    Returned = @($result.Rows).Count;
    Truncated = ($result.Matched -gt @($result.Rows).Count);
    Pages = $result.Rows;
};
`;
}

export function getPagesBySitePowershellTool(server: McpServer, config: Config) {
    server.registerTool(
        "get-pages-by-site",
        {
            description: `Lists the pages of a site. ${ROW_DESCRIPTION}`,
            inputSchema: {
                ...siteSelectorInputSchema,
                rootPath: z.string().optional().describe(ROOT_PATH_DESCRIPTION),
                limit: z.number().optional().describe(LIMIT_DESCRIPTION),
            },
        },
        async (params) => {
            if (!params.siteName && !params.path) {
                return { isError: true, content: [{ type: "text", text: MISSING_SITE_SELECTOR }] };
            }

            const command = `
${SITE_SCOPE_FUNCTIONS}
${SITE_READ_FUNCTIONS}
${siteResolutionScript(params, quotePowerShellString)}
${pageRowsScript(params)}`;
            return safeMcpResponse(runGenericPowershellCommand(config, command, {}));
        }
    );

    server.registerTool(
        "search-site-pages",
        {
            description:
                "Searches a site's pages by name or title, case-insensitively, on a substring "
                + `match against Name, display name, Title and NavigationTitle. ${ROW_DESCRIPTION}`,
            inputSchema: {
                ...siteSelectorInputSchema,
                query: z.string().describe("The text to look for in the page's name, display name, Title or NavigationTitle."),
                rootPath: z.string().optional().describe(ROOT_PATH_DESCRIPTION),
                limit: z.number().optional().describe(LIMIT_DESCRIPTION),
            },
        },
        async (params) => {
            if (!params.siteName && !params.path) {
                return { isError: true, content: [{ type: "text", text: MISSING_SITE_SELECTOR }] };
            }

            const command = `
${SITE_SCOPE_FUNCTIONS}
${SITE_READ_FUNCTIONS}
${siteResolutionScript(params, quotePowerShellString)}
${pageRowsScript(params)}`;
            return safeMcpResponse(runGenericPowershellCommand(config, command, {}));
        }
    );
}
