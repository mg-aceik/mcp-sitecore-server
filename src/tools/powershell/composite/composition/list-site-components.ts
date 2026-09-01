import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
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
import { z } from "zod";

/**
 * The renderings a site offers, grouped as the site groups them.
 *
 * **`Available Renderings` is not an allow-list**, and conflating the two was a wrong turn
 * in the investigation this tier came out of. A Stride site groups its renderings into
 * `Page Content`, `Page Structure`, `FEaaS`, `Forms` and `Global`; the five components
 * allowed in `headless-main` span two of those groups, so the groups say nothing about
 * where a rendering may be placed. This tool answers "what components does this site
 * have"; `get-allowed-components-by-placeholder` answers "may this one go here". Keep them
 * apart.
 */
const DESCRIPTION =
    "Lists the renderings a site makes available, grouped by its Available Renderings "
    + "groups (Page Content, Page Structure, FEaaS, Forms, Global on a Stride site). This "
    + "is the site's component inventory, NOT an allow-list: the groups do not determine "
    + "where a rendering may be placed. Use get-allowed-components-by-placeholder for that. "
    + "IDs that resolve to no item are reported under Unresolved per group.";

export function listSiteComponentsPowershellTool(server: McpServer, config: Config) {
    server.registerTool(
        "list-site-components",
        {
            description: DESCRIPTION,
            inputSchema: z.object({
                ...siteSelectorInputSchema,
            }),
        },
        async (params) => {
            if (!params.siteName && !params.path) {
                return { isError: true, content: [{ type: "text", text: MISSING_SITE_SELECTOR }] };
            }

            const command = `
${SITE_SCOPE_FUNCTIONS}
${SITE_READ_FUNCTIONS}
${siteResolutionScript(params, quotePowerShellString)}
$availableRoot = $siteRootItem.Paths.FullPath + '/Presentation/Available Renderings';
$groupItems = @(Get-ChildItem -Path ($siteDatabase + ':' + $availableRoot) -ErrorAction SilentlyContinue);
if ($groupItems.Count -eq 0) {
    Write-Error ("No Available Renderings groups were found at '" + $availableRoot + "'. On a site without them, use the renderings folder directly (see get-site-information) or read the placeholder allow-lists with get-allowed-components-by-placeholder.");
    return;
}
$groups = @();
foreach ($groupItem in $groupItems) {
    $ids = @(Get-McpDelimitedList -Value $groupItem['Renderings']);
    $rows = Get-McpItemRows -Database $siteDatabase -Ids $ids;
    $groups += [PSCustomObject]@{
        Group = $groupItem.Name;
        GroupPath = $groupItem.Paths.FullPath;
        Renderings = $rows.Resolved;
        Unresolved = $rows.Unresolved;
    };
}
[PSCustomObject]@{
    SiteName = $siteRow.Name;
    AvailableRenderingsPath = $availableRoot;
    Groups = $groups;
};
`;
            return safeMcpResponse(runGenericPowershellCommand(config, command, {}));
        }
    );
}
