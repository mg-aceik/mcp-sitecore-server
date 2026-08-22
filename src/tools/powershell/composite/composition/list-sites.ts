import type { McpServer } from "@modelcontextprotocol/server";
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
 * The two site-level reads: what sites exist, and where one site keeps its things.
 *
 * `get-site-information` exists to save the follow-up calls. Every composition tool needs
 * one of the same handful of paths — the home item, the placeholder settings root, the
 * available renderings root, the shared data folder — and they are all derivable from the
 * site root, so returning them together costs nothing and removes a round trip each.
 */

const LIST_DESCRIPTION =
    "Lists the content sites registered on this CM: name, root path, start (home) path, "
    + "database, hostname and the root item's ID and template. Sitecore's own "
    + "infrastructure sites (shell, login, service, ...) are filtered out; pass "
    + "includeSystemSites to see everything Sitecore has registered. Note that 'website' "
    + "is reported — on XM/XP it is the content site, and on an XM Cloud CM it shows up "
    + "rooted at /sitecore/content alongside the real content sites.";

const INFO_DESCRIPTION =
    "Returns one site's definition plus the paths the composition tools need: the home "
    + "item, the site-level Placeholder Settings root, the Available Renderings root, the "
    + "shared Data folder, the site definition item, and the project (tenant) folder used "
    + "to resolve global placeholder settings. Address the site by name, or by any item "
    + "path inside it.";

export function listSitesPowershellTool(server: McpServer, config: Config) {
    server.registerTool(
        "list-sites",
        {
            description: LIST_DESCRIPTION,
            inputSchema: z.object({
                includeSystemSites: z.boolean().optional()
                    .describe("Include Sitecore's infrastructure sites (shell, login, admin, service, scheduler, ...). Off by default."),
            }),
        },
        async (params) => {
            const command = `
${SITE_SCOPE_FUNCTIONS}
${SITE_READ_FUNCTIONS}
Get-McpSiteRows -IncludeSystemSites $${params.includeSystemSites ? "true" : "false"};
`;
            return safeMcpResponse(runGenericPowershellCommand(config, command, {}));
        }
    );

    server.registerTool(
        "get-site-information",
        {
            description: INFO_DESCRIPTION,
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
function Get-McpOptionalPath {
    param([string]$Database, [string]$Path)
    $item = Get-Item -Path ($Database + ':' + $Path) -ErrorAction SilentlyContinue;
    if ($null -eq $item) { return $null }
    return $item.Paths.FullPath;
}
$root = $siteRootItem.Paths.FullPath;
$siteDefinition = $null;
$grouping = Get-Item -Path ($siteDatabase + ':' + $root + '/Settings/Site Grouping') -ErrorAction SilentlyContinue;
if ($null -ne $grouping) {
    $definitionItem = @(Get-ChildItem -Path ($siteDatabase + ':' + $grouping.Paths.FullPath) -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -eq $siteRow.Name }) | Select-Object -First 1;
    if ($null -eq $definitionItem) {
        $definitionItem = @(Get-ChildItem -Path ($siteDatabase + ':' + $grouping.Paths.FullPath) -ErrorAction SilentlyContinue) | Select-Object -First 1;
    }
    if ($null -ne $definitionItem) { $siteDefinition = $definitionItem.Paths.FullPath }
}
[PSCustomObject]@{
    Name = $siteRow.Name;
    RootPath = $siteRow.RootPath;
    StartPath = $siteRow.StartPath;
    Database = $siteRow.Database;
    HostName = $siteRow.HostName;
    TargetHostName = $siteRow.TargetHostName;
    Language = $siteRow.Language;
    RootItemID = $siteRow.RootItemID;
    RootItemTemplate = $siteRow.RootItemTemplate;
    StartItemID = $siteRow.StartItemID;
    Project = Get-McpProjectName -SiteRoot $siteRootItem;
    SiteDefinitionItemPath = $siteDefinition;
    PlaceholderSettingsPath = Get-McpOptionalPath -Database $siteDatabase -Path ($root + '/Presentation/Placeholder Settings');
    AvailableRenderingsPath = Get-McpOptionalPath -Database $siteDatabase -Path ($root + '/Presentation/Available Renderings');
    PageDesignsPath = Get-McpOptionalPath -Database $siteDatabase -Path ($root + '/Presentation/Page Designs');
    SharedDataPath = Get-McpOptionalPath -Database $siteDatabase -Path ($root + '/Data');
    SettingsPath = Get-McpOptionalPath -Database $siteDatabase -Path ($root + '/Settings');
    GlobalPlaceholderSettingsPath = Get-McpOptionalPath -Database $siteDatabase -Path ('/sitecore/layout/Placeholder Settings/Project/' + (Get-McpProjectName -SiteRoot $siteRootItem));
};
`;
            return safeMcpResponse(runGenericPowershellCommand(config, command, {}));
        }
    );
}
