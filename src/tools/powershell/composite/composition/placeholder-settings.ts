import { z } from "zod";

/**
 * Placeholder settings resolution — the knowledge that stops an agent writing a layout
 * the CM forbids.
 *
 * Allowed components live on placeholder settings items in **two layers**, and both have
 * to be consulted:
 *
 * 1. Site-level — `<site>/Presentation/Placeholder Settings/**`
 * 2. Global — `/sitecore/layout/Placeholder Settings/Project/<project>/**`
 *
 * Site-level wins; the global Project tree is the fallback. Verified against a Stride
 * site: `global-header-desktop-secondary-right-{*}`, `headless-meta`, `social-follow-{*}`
 * and `global-alert-banner-cta-{*}` exist **only** in the global tree, so a resolver that
 * reads the site layer alone answers "nothing is allowed" for four real placeholders. The
 * fallback is also what makes this work beyond XM Cloud: a plain XM/XP site has no
 * site-level settings items at all and the global tree is the only layer there is.
 *
 * Three details that bite, all handled here:
 *
 * - **Separators differ by source.** `Allowed Controls` is pipe-separated when read from
 *   `master` and newline-separated in Sitecore Content Serialization YAML. Split on both.
 * - **Dangling IDs.** The sampled `headless-main` field held seven IDs and two resolved
 *   to no item. They are dropped from `Allowed` — an unresolvable rendering cannot be
 *   added — but reported under `Unresolved`, because a dangling allowed-control reference
 *   is a real content defect and hiding it entirely helps nobody.
 * - **Dynamic placeholders are wildcard-keyed.** `container-{*}`, `page-section-{*}`,
 *   `column-1-{*}`, `tab-1-{*}` and friends. A runtime path like
 *   `/headless-main/page-section-1/container-2` is resolved from its **leaf** segment
 *   (`container-2`) matched against those wildcard keys.
 */

/**
 * `Allowed Controls` parsing, wildcard key matching, and the two-layer resolver.
 * Requires `SITE_SCOPE_FUNCTIONS` to be prepended first.
 */
export const PLACEHOLDER_SETTINGS_FUNCTIONS = `
function Get-McpAllowedControlIds {
    param([string]$Value)

    if ([string]::IsNullOrWhiteSpace($Value)) { return @() }
    # Pipe from the database, newline from serialized YAML. Split on both so the same
    # resolver works against either source.
    return @($Value -split '[|\\r\\n]' | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' });
}

function Get-McpPlaceholderKeyPattern {
    param([string]$Key)

    if (-not $Key.Contains('{*}')) {
        return '^' + [System.Text.RegularExpressions.Regex]::Escape($Key) + '$';
    }

    # A trailing '-{*}' is the dynamic-placeholder suffix, and the stem on its own is a
    # legitimate way to ask about the placeholder: 'container-{*}' governs both
    # 'container-2' and a bare 'container'.
    if ($Key.EndsWith('-{*}')) {
        $stem = [System.Text.RegularExpressions.Regex]::Escape($Key.Substring(0, $Key.Length - 4));
        return '^' + $stem + '(-.*)?$';
    }

    $escaped = @();
    foreach ($part in ($Key -split '\\{\\*\\}')) { $escaped += [System.Text.RegularExpressions.Regex]::Escape($part) }
    return '^' + ($escaped -join '.*') + '$';
}

function Get-McpPlaceholderSettingsItems {
    param([string]$Database, [string]$Root)

    return @(Get-ChildItem -Path ($Database + ':' + $Root) -Recurse -ErrorAction SilentlyContinue |
        Where-Object { $null -ne $_.Fields['Placeholder Key'] -and -not [string]::IsNullOrWhiteSpace($_['Placeholder Key']) });
}

function Get-McpPlaceholderLeaf {
    param([string]$PlaceholderPath)

    $leaf = ($PlaceholderPath -split '/' | Where-Object { $_ -ne '' } | Select-Object -Last 1);
    if ([string]::IsNullOrWhiteSpace($leaf)) { return $null }
    return $leaf.Trim();
}

function Resolve-McpPlaceholderSettings {
    param([Sitecore.Data.Items.Item]$Item, [string]$PlaceholderPath, [string]$Project)

    $database = $Item.Database.Name;
    $leaf = Get-McpPlaceholderLeaf -PlaceholderPath $PlaceholderPath;
    if ($null -eq $leaf) { return $null }

    $siteRoot = Get-McpSiteRoot -Item $Item;
    $project = $Project;
    if ([string]::IsNullOrWhiteSpace($project)) { $project = Get-McpProjectName -SiteRoot $siteRoot }

    # Site level first, then the global Project tree narrowed to this project, then the
    # whole Project tree, then the whole global tree. Each scope is a superset of the one
    # before it, so ordering is what gives site-level settings precedence; the wider
    # scopes are only ever scanned when the narrower ones did not answer.
    $scopes = New-Object System.Collections.ArrayList;
    if ($null -ne $siteRoot) {
        [void]$scopes.Add([PSCustomObject]@{ Scope = 'site'; Root = ($siteRoot.Paths.FullPath + '/Presentation/Placeholder Settings') });
    }
    if (-not [string]::IsNullOrWhiteSpace($project)) {
        [void]$scopes.Add([PSCustomObject]@{ Scope = 'global'; Root = ('/sitecore/layout/Placeholder Settings/Project/' + $project) });
    }
    [void]$scopes.Add([PSCustomObject]@{ Scope = 'global'; Root = '/sitecore/layout/Placeholder Settings/Project' });
    [void]$scopes.Add([PSCustomObject]@{ Scope = 'global'; Root = '/sitecore/layout/Placeholder Settings' });

    $searched = @();
    foreach ($scope in $scopes) {
        $searched += $scope.Root;
        $candidates = Get-McpPlaceholderSettingsItems -Database $database -Root $scope.Root;
        if ($candidates.Count -eq 0) { continue }

        $exact = @($candidates | Where-Object { $_['Placeholder Key'] -eq $leaf }) | Select-Object -First 1;
        if ($null -ne $exact) {
            return [PSCustomObject]@{
                SettingsItem = $exact;
                PlaceholderKey = $exact['Placeholder Key'];
                Scope = $scope.Scope;
                MatchType = 'exact';
                Leaf = $leaf;
                SiteRoot = $siteRoot;
                Project = $project;
                ScopesSearched = $searched;
            };
        }

        # Longest literal stem wins, so 'column-1-{*}' beats a hypothetical 'column-{*}'
        # for the key 'column-1-7'.
        $best = $null;
        $bestStem = -1;
        foreach ($candidate in $candidates) {
            $key = $candidate['Placeholder Key'];
            if (-not $key.Contains('{*}')) { continue }
            $pattern = Get-McpPlaceholderKeyPattern -Key $key;
            if ([System.Text.RegularExpressions.Regex]::IsMatch($leaf, $pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
                $stemLength = $key.IndexOf('{*}');
                if ($stemLength -gt $bestStem) { $bestStem = $stemLength; $best = $candidate }
            }
        }
        if ($null -ne $best) {
            return [PSCustomObject]@{
                SettingsItem = $best;
                PlaceholderKey = $best['Placeholder Key'];
                Scope = $scope.Scope;
                MatchType = 'wildcard';
                Leaf = $leaf;
                SiteRoot = $siteRoot;
                Project = $project;
                ScopesSearched = $searched;
            };
        }
    }

    return [PSCustomObject]@{
        SettingsItem = $null;
        PlaceholderKey = $null;
        Scope = $null;
        MatchType = 'none';
        Leaf = $leaf;
        SiteRoot = $siteRoot;
        Project = $project;
        ScopesSearched = $searched;
    };
}

function Get-McpAllowedComponents {
    param([Sitecore.Data.Items.Item]$Item, [string]$PlaceholderPath, [string]$Project)

    $database = $Item.Database.Name;
    $match = Resolve-McpPlaceholderSettings -Item $Item -PlaceholderPath $PlaceholderPath -Project $Project;
    if ($null -eq $match) {
        Write-Error 'placeholderPath is empty. Pass a placeholder key (e.g. headless-main) or a runtime placeholder path (e.g. /headless-main/page-section-1/container-2).';
        return $null;
    }

    $siteRootPath = $null;
    if ($null -ne $match.SiteRoot) { $siteRootPath = $match.SiteRoot.Paths.FullPath }

    if ($null -eq $match.SettingsItem) {
        return [PSCustomObject]@{
            PlaceholderPath = $PlaceholderPath;
            PlaceholderKeyRequested = $match.Leaf;
            PlaceholderKey = $null;
            SettingsItemPath = $null;
            SettingsItemID = $null;
            Scope = $null;
            MatchType = 'none';
            SiteRootPath = $siteRootPath;
            Found = $false;
            Allowed = @();
            Unresolved = @();
            ScopesSearched = @($match.ScopesSearched);
        };
    }

    $allowed = @();
    $unresolved = @();
    $seen = @{};
    foreach ($id in (Get-McpAllowedControlIds -Value $match.SettingsItem['Allowed Controls'])) {
        if ($seen.ContainsKey($id)) { continue }
        $seen[$id] = 1;
        $rendering = $null;
        try { $rendering = Get-Item -Path ($database + ':') -ID $id -ErrorAction SilentlyContinue } catch { $rendering = $null }
        if ($null -ne $rendering) {
            $allowed += [PSCustomObject]@{ ID = $rendering.ID.ToString(); Name = $rendering.Name };
        }
        else {
            # Dropped from Allowed because it cannot be added, reported because a dangling
            # allowed-control reference is a content defect worth surfacing.
            $unresolved += $id;
        }
    }

    return [PSCustomObject]@{
        PlaceholderPath = $PlaceholderPath;
        PlaceholderKeyRequested = $match.Leaf;
        PlaceholderKey = $match.PlaceholderKey;
        SettingsItemPath = $match.SettingsItem.Paths.FullPath;
        SettingsItemID = $match.SettingsItem.ID.ToString();
        Scope = $match.Scope;
        MatchType = $match.MatchType;
        SiteRootPath = $siteRootPath;
        Found = $true;
        Allowed = $allowed;
        Unresolved = $unresolved;
    };
}
`;

export const PLACEHOLDER_PATH_DESCRIPTION =
    "The placeholder to resolve. Accepts a bare key ('headless-main', 'container', "
    + "'container-{*}') or a full runtime placeholder path "
    + "('/headless-main/page-section-1/container-2'), in which case the leaf segment is "
    + "matched — including against the wildcard keys dynamic placeholders use.";

export const PROJECT_DESCRIPTION =
    "Overrides the folder searched under /sitecore/layout/Placeholder Settings/Project. "
    + "Defaults to the project (tenant) folder of the site the item belongs to, and falls "
    + "back to the whole global Placeholder Settings tree.";

export const placeholderResolutionInputSchema = {
    placeholderPath: z.string().describe(PLACEHOLDER_PATH_DESCRIPTION),
    project: z.string().optional().describe(PROJECT_DESCRIPTION),
};
