import { z } from "zod";
import { SYSTEM_SITE_NAMES_POWERSHELL } from "./site-scope.js";

/**
 * Site enumeration and the page set of a site.
 *
 * The site list comes from `Factory.GetSiteInfoList()`, which is what Sitecore actually
 * serves from, rather than from the `Site` definition items under
 * `<site>/Settings/Site Grouping`. Both exist on SitecoreAI, only the first exists on XM/XP,
 * and the first is the one that answers "which sites are there". The definition item is
 * still reported when it can be found, because that is what a caller edits.
 *
 * **What counts as a page** is the one judgement call here, and it is made on
 * presentation rather than on template names: an item is a page when it has a layout
 * (`__Renderings` or `__Final Renderings` resolves to a non-empty value, standard values
 * included). Template-name matching would be a per-project guess; this is the property
 * that makes an item addressable as a page at all. Verified against the sampled Cova site:
 * 234 descendants of Home, 22 of them pages — the same 22 the benchmark counted.
 */
export const SITE_READ_FUNCTIONS = `
function Get-McpSiteRows {
    param([bool]$IncludeSystemSites)

    $systemSites = ${SYSTEM_SITE_NAMES_POWERSHELL};
    $rows = @();
    foreach ($info in [Sitecore.Configuration.Factory]::GetSiteInfoList()) {
        $rootPath = $info.RootPath;
        if (-not $IncludeSystemSites) {
            if ([string]::IsNullOrWhiteSpace($rootPath)) { continue }
            if (-not $rootPath.StartsWith('/sitecore/content', [System.StringComparison]::OrdinalIgnoreCase)) { continue }
            if ($systemSites -contains $info.Name.ToLowerInvariant()) { continue }
        }
        $rows += Get-McpSiteRow -Info $info;
    }
    return $rows;
}

function Get-McpSiteRow {
    param($Info)

    $rootPath = $Info.RootPath;
    if ($null -ne $rootPath) { $rootPath = $rootPath.TrimEnd('/') }
    $database = $Info.Database;
    if ([string]::IsNullOrWhiteSpace($database)) { $database = 'master' }

    $startPath = $null;
    if (-not [string]::IsNullOrWhiteSpace($rootPath)) {
        $startItemPath = $Info.StartItem;
        if ([string]::IsNullOrWhiteSpace($startItemPath)) { $startItemPath = '' }
        elseif (-not $startItemPath.StartsWith('/')) { $startItemPath = '/' + $startItemPath }
        $startPath = $rootPath + $startItemPath;
    }

    $rootItem = $null;
    if (-not [string]::IsNullOrWhiteSpace($rootPath)) {
        $rootItem = Get-Item -Path ($database + ':' + $rootPath) -ErrorAction SilentlyContinue;
    }
    $startItem = $null;
    if (-not [string]::IsNullOrWhiteSpace($startPath)) {
        $startItem = Get-Item -Path ($database + ':' + $startPath) -ErrorAction SilentlyContinue;
    }

    return [PSCustomObject]@{
        Name = $Info.Name;
        RootPath = $rootPath;
        StartPath = $startPath;
        Database = $database;
        HostName = $Info.HostName;
        TargetHostName = $Info.TargetHostName;
        Language = $Info.Language;
        RootItemID = $(if ($null -ne $rootItem) { $rootItem.ID.ToString() } else { $null });
        RootItemTemplate = $(if ($null -ne $rootItem) { $rootItem.TemplateName } else { $null });
        StartItemID = $(if ($null -ne $startItem) { $startItem.ID.ToString() } else { $null });
    };
}

function Get-McpSiteInfoByName {
    param([string]$SiteName)

    foreach ($info in [Sitecore.Configuration.Factory]::GetSiteInfoList()) {
        if ($info.Name -eq $SiteName) { return $info }
    }
    return $null;
}

function Get-McpSiteInfoByRoot {
    param([string]$RootPath)

    $best = $null;
    foreach ($info in [Sitecore.Configuration.Factory]::GetSiteInfoList()) {
        $root = $info.RootPath;
        if ([string]::IsNullOrWhiteSpace($root)) { continue }
        $root = $root.TrimEnd('/');
        if ($root -ne $RootPath) { continue }
        # Prefer a site whose name is not one of Sitecore's infrastructure sites, which
        # share /sitecore/content as their root.
        if ($null -eq $best -or (${SYSTEM_SITE_NAMES_POWERSHELL} -contains $best.Name.ToLowerInvariant())) { $best = $info }
    }
    return $best;
}

function Test-McpIsPage {
    param([Sitecore.Data.Items.Item]$Item)

    # Presentation, not template name: an item is a page when it has a layout. The field
    # read inherits from the template's standard values, which is where a page template
    # normally carries its presentation.
    foreach ($fieldName in @('__Renderings', '__Final Renderings')) {
        $field = $Item.Fields[$fieldName];
        if ($null -ne $field -and -not [string]::IsNullOrWhiteSpace($field.Value)) { return $true }
    }
    return $false;
}

function Get-McpPageRows {
    param([Sitecore.Data.Items.Item]$Root, [string]$Query, [int]$Limit)

    $matched = 0;
    $rows = @();
    $candidates = @($Root) + @(Get-ChildItem -Path ($Root.Database.Name + ':' + $Root.Paths.FullPath) -Recurse -ErrorAction SilentlyContinue);
    foreach ($candidate in $candidates) {
        if (-not (Test-McpIsPage -Item $candidate)) { continue }
        if (-not [string]::IsNullOrWhiteSpace($Query)) {
            $haystack = @($candidate.Name, $candidate.DisplayName, $candidate['Title'], $candidate['NavigationTitle']);
            $hit = $false;
            foreach ($value in $haystack) {
                if ([string]::IsNullOrWhiteSpace($value)) { continue }
                if ($value.IndexOf($Query, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) { $hit = $true; break }
            }
            if (-not $hit) { continue }
        }
        $matched++;
        if ($Limit -gt 0 -and $rows.Count -ge $Limit) { continue }
        $rows += [PSCustomObject]@{
            ID = $candidate.ID.ToString();
            Path = $candidate.Paths.FullPath;
            Template = $candidate.TemplateName;
            TemplateID = $candidate.TemplateID.ToString();
        };
    }
    return [PSCustomObject]@{ Matched = $matched; Rows = $rows };
}
`;

export const SITE_NAME_DESCRIPTION =
    "The site name as Sitecore knows it (e.g. 'Cova'). Use list-sites to see the names. "
    + "Supply this or path.";

export const siteSelectorInputSchema = {
    siteName: z.string().optional().describe(SITE_NAME_DESCRIPTION),
    path: z.string().optional()
        .describe("Any item path inside the site, used to work out which site is meant (e.g. /sitecore/content/Stride/Cova/Home). Supply this or siteName."),
    database: z.string().optional()
        .describe("The database to read. Defaults to the site's own database, or master."),
};

export type SiteSelector = {
    siteName?: string;
    path?: string;
    database?: string;
};

/**
 * PowerShell that resolves `$siteRow` (and `$siteRootItem`) from the selector, or reports
 * why it could not. Callers append the rest of their script after this.
 */
export function siteResolutionScript(selector: SiteSelector, quote: (value: unknown) => string): string {
    if (selector.siteName) {
        return `
$siteInfo = Get-McpSiteInfoByName -SiteName ${quote(selector.siteName)};
if ($null -eq $siteInfo) {
    Write-Error ("No site named '" + ${quote(selector.siteName)} + "' is registered on this CM. Use list-sites to see the site names.");
    return;
}
$siteRow = Get-McpSiteRow -Info $siteInfo;
$siteDatabase = ${selector.database ? quote(selector.database) : "$siteRow.Database"};
$siteRootItem = Get-Item -Path ($siteDatabase + ':' + $siteRow.RootPath) -ErrorAction SilentlyContinue;
if ($null -eq $siteRootItem) {
    Write-Error ("The site '" + $siteRow.Name + "' has root path '" + $siteRow.RootPath + "', which resolves to no item in database '" + $siteDatabase + "'.");
    return;
}
`;
    }

    const path = selector.path!;
    const qualified = path.includes(":") ? path : `${selector.database || "master"}:${path}`;
    return `
$contextItem = Get-Item -Path ${quote(qualified)} -ErrorAction SilentlyContinue;
if ($null -eq $contextItem) {
    Write-Error ("No item was found at '" + ${quote(qualified)} + "', so the site could not be worked out. Verify the path and database.");
    return;
}
$siteRootItem = Get-McpSiteRoot -Item $contextItem;
if ($null -eq $siteRootItem) {
    Write-Error ("No site owns the item at '" + $contextItem.Paths.FullPath + "'. Pass siteName instead, or use list-sites to see which roots are registered.");
    return;
}
$siteDatabase = $siteRootItem.Database.Name;
$siteInfo = Get-McpSiteInfoByRoot -RootPath $siteRootItem.Paths.FullPath;
if ($null -ne $siteInfo) { $siteRow = Get-McpSiteRow -Info $siteInfo }
else {
    # The subtree carries site content but no site definition points at it, which happens
    # on a CM where the site has not been registered yet. Report what is knowable.
    $siteRow = [PSCustomObject]@{
        Name = $siteRootItem.Name;
        RootPath = $siteRootItem.Paths.FullPath;
        StartPath = $siteRootItem.Paths.FullPath + '/Home';
        Database = $siteDatabase;
        HostName = $null;
        TargetHostName = $null;
        Language = $null;
        RootItemID = $siteRootItem.ID.ToString();
        RootItemTemplate = $siteRootItem.TemplateName;
        StartItemID = $null;
    };
}
`;
}

/** The message for a site-scoped call that supplied neither identifier. */
export const MISSING_SITE_SELECTOR =
    "Supply either 'siteName' or 'path'. Neither was provided, and there is no default site.";
