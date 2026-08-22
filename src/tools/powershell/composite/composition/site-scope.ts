import { z } from "zod";
import { quotePowerShellString } from "../../command-builder.js";
import { renderingLookupGuard } from "../presentation/rendering-guard.js";

/**
 * Site scoping for the composition tools.
 *
 * Every Tier 1 tool needs the same two facts before it can do anything: which item the
 * caller means, and which *site* that item belongs to. The site answer is what makes
 * placeholder settings, datasource locations and available renderings resolvable at all,
 * because all three live under the site root.
 *
 * The site is resolved from `Factory.GetSiteInfoList()` rather than by walking the
 * content tree looking for a known template. That list is what Sitecore itself serves
 * from, so it is correct on XM Cloud (where SXA registers a site per content site item)
 * *and* on XM/XP (where the site is defined in config and its root may be
 * `/sitecore/content` itself). The template-based shortcut — "find the ancestor whose
 * template is Headless Site" — only works on XM Cloud, and this server targets both.
 */

/** Sitecore's own infrastructure sites, which are never content sites. */
const SYSTEM_SITE_NAMES = [
    "shell",
    "login",
    "admin",
    "service",
    "modules_shell",
    "modules_website",
    "scheduler",
    "system",
    "publisher",
    "testing",
    "jssglobalizationapi",
    "graphqlapi",
];

/**
 * PowerShell rendering of the system-site denylist above, for the `list-sites` filter.
 *
 * `website` is deliberately absent: on XM/XP it is *the* content site, and hiding it
 * would make the tool useless there. On an XM Cloud CM it shows up alongside the real
 * content sites, rooted at `/sitecore/content`, which is truthful rather than tidy.
 */
export const SYSTEM_SITE_NAMES_POWERSHELL = `@(${SYSTEM_SITE_NAMES.map(quotePowerShellString).join(", ")})`;

/**
 * PowerShell functions for locating a site from an item. Prepend to any command that
 * needs `Get-McpSiteRoot` or `Get-McpProjectName`.
 */
export const SITE_SCOPE_FUNCTIONS = `
function Get-McpDelimitedList {
    param([string]$Value)

    # Sitecore's multi-value fields are pipe-separated in the database and newline-separated
    # in serialized YAML. Every caller here reads one or the other, so both are accepted.
    if ([string]::IsNullOrWhiteSpace($Value)) { return @() }
    return @($Value -split '[|\\r\\n]' | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' });
}

function Get-McpItemRows {
    param([string]$Database, [string[]]$Ids)

    # Resolves a list of IDs to {ID, Name} rows and reports the ones that resolve to
    # nothing, which is the same contract get-allowed-components-by-placeholder uses: a
    # dangling reference is dropped from the usable list but never hidden.
    $resolved = @();
    $unresolved = @();
    $seen = @{};
    foreach ($id in $Ids) {
        if ($seen.ContainsKey($id)) { continue }
        $seen[$id] = 1;
        $item = $null;
        try { $item = Get-Item -Path ($Database + ':') -ID $id -ErrorAction SilentlyContinue } catch { $item = $null }
        if ($null -ne $item) { $resolved += [PSCustomObject]@{ ID = $item.ID.ToString(); Name = $item.Name } }
        else { $unresolved += $id }
    }
    return [PSCustomObject]@{ Resolved = $resolved; Unresolved = $unresolved };
}

function Get-McpSiteRoot {
    param([Sitecore.Data.Items.Item]$Item)

    $itemPath = $Item.Paths.FullPath;
    $database = $Item.Database.Name;

    # Every site whose root is this item or an ancestor of it, deepest root first: a
    # content site nested under another site's root must win over the outer one.
    $roots = New-Object System.Collections.ArrayList;
    foreach ($info in [Sitecore.Configuration.Factory]::GetSiteInfoList()) {
        $root = $info.RootPath;
        if ([string]::IsNullOrWhiteSpace($root)) { continue }
        $root = $root.TrimEnd('/');
        if ($root -eq '') { continue }
        if ($itemPath -eq $root -or $itemPath.StartsWith($root + '/', [System.StringComparison]::OrdinalIgnoreCase)) {
            if (-not $roots.Contains($root)) { [void]$roots.Add($root) }
        }
    }
    $ordered = @($roots | Sort-Object -Property Length -Descending);

    # Prefer a site root that actually owns a site-level placeholder settings tree. On an
    # XM Cloud CM several sites are rooted at /sitecore/content (website, modules_website,
    # ...) and only the real content site carries the Presentation folder.
    foreach ($root in $ordered) {
        $settings = Get-Item -Path ($database + ':' + $root + '/Presentation/Placeholder Settings') -ErrorAction SilentlyContinue;
        if ($settings) {
            $resolved = Get-Item -Path ($database + ':' + $root) -ErrorAction SilentlyContinue;
            if ($resolved) { return $resolved }
        }
    }

    # No site definition points at a subtree with placeholder settings: walk up from the
    # item instead, which covers a site whose definition item is missing or not yet
    # registered in this database.
    $current = $Item;
    while ($null -ne $current) {
        $settings = Get-Item -Path ($database + ':' + $current.Paths.FullPath + '/Presentation/Placeholder Settings') -ErrorAction SilentlyContinue;
        if ($settings) { return $current }
        $current = $current.Parent;
    }

    # Plain XM/XP: there is no site-level settings tree at all, so the site root is
    # whatever Sitecore says it is. The caller then resolves against the global tree only.
    foreach ($root in $ordered) {
        $resolved = Get-Item -Path ($database + ':' + $root) -ErrorAction SilentlyContinue;
        if ($resolved) { return $resolved }
    }
    return $null;
}

function Get-McpProjectName {
    param([Sitecore.Data.Items.Item]$SiteRoot)

    if ($null -eq $SiteRoot) { return $null }
    # /sitecore/content/<project>/<site> is the XM Cloud tenant layout, and <project> is
    # also the folder name used under /sitecore/layout/Placeholder Settings/Project.
    $segments = @($SiteRoot.Paths.FullPath -split '/' | Where-Object { $_ -ne '' });
    if ($segments.Count -ge 3) { return $segments[2] }
    return $null;
}
`;

const PATH_DESCRIPTION =
    "The full path of the item, database prefix optional (e.g. "
    + "master:/sitecore/content/Stride/Cova/Home or /sitecore/content/Stride/Cova/Home).";

const DATABASE_DESCRIPTION =
    "The database to read. Defaults to master, and is ignored when path carries its own prefix.";

const LANGUAGE_DESCRIPTION = "The item language. Defaults to the context language.";

/**
 * Input shape for a tool that takes one page, addressed either way.
 *
 * Tier 2 merges the server's `-by-id`/`-by-path` tool pairs into single tools, so a new
 * tool has no reason to arrive as a pair: it takes both and requires one.
 */
export const pageSelectorInputSchema = {
    path: z.string().optional().describe(`${PATH_DESCRIPTION} Supply this or pageId.`),
    pageId: z.string().optional()
        .describe("The ID of the page item (e.g. {110D559F-DEA5-42EA-9C1C-8A5DF7E70EF9}). Supply this or path."),
    database: z.string().optional().describe(DATABASE_DESCRIPTION),
    language: z.string().optional().describe(LANGUAGE_DESCRIPTION),
};

/** The same selector for a tool that reads any item, not specifically a page. */
export const itemSelectorInputSchema = {
    path: z.string().optional().describe(`${PATH_DESCRIPTION} Supply this or itemId.`),
    itemId: z.string().optional()
        .describe("The ID of the item (e.g. {110D559F-DEA5-42EA-9C1C-8A5DF7E70EF9}). Supply this or path."),
    database: z.string().optional().describe(DATABASE_DESCRIPTION),
    language: z.string().optional().describe(LANGUAGE_DESCRIPTION),
};

export type ItemSelector = {
    path?: string;
    pageId?: string;
    itemId?: string;
    database?: string;
    language?: string;
};

/** The database a selector reads, taking a `db:` prefix on the path into account. */
export function selectorDatabase(selector: ItemSelector): string {
    const prefix = selector.path?.includes(":") ? selector.path.split(":")[0].trim() : "";
    return prefix || selector.database || "master";
}

/**
 * The `Get-Item` expression for a selector, or `undefined` when neither a path nor an ID
 * was supplied. Callers turn `undefined` into the error result; there is no sensible
 * default item.
 */
export function itemLookupExpression(selector: ItemSelector): string | undefined {
    const id = selector.pageId ?? selector.itemId;
    const language = selector.language ? ` -Language ${quotePowerShellString(selector.language)}` : "";

    if (selector.path) {
        const path = selector.path.includes(":")
            ? selector.path
            : `${selectorDatabase(selector)}:${selector.path}`;
        return `Get-Item -Path ${quotePowerShellString(path)}${language} -ErrorAction SilentlyContinue`;
    }

    if (id) {
        const database = `${selectorDatabase(selector)}:`;
        return `Get-Item -Path ${quotePowerShellString(database)} -ID ${quotePowerShellString(id)}${language} -ErrorAction SilentlyContinue`;
    }

    return undefined;
}

/** The message for a call that supplied neither a path nor an ID. */
export function missingSelectorMessage(idKey: string): string {
    return `Supply either 'path' or '${idKey}'. Neither was provided, and there is no default item.`;
}

/**
 * `$null` guard for an item lookup. The reason this reports with `Write-Error` rather
 * than `throw` is the SPE remoting transport, documented in full on
 * `presentation/rendering-guard.ts`.
 */
export function itemLookupGuard(variable: string, message: string): string {
    return renderingLookupGuard(variable, message);
}

/** The standard "item not found" message for a selector-driven lookup. */
export function itemNotFoundMessage(noun: string): string {
    return `No ${noun} was found for the supplied path or ID. Verify the path or ID, the `
        + `database and the language, and that the item exists in that language.`;
}
