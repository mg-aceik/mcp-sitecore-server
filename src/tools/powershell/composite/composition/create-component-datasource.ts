import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { runGenericPowershellCommand } from "../../simple/generic.js";
import { quotePowerShellString } from "../../command-builder.js";
import {
    SITE_SCOPE_FUNCTIONS,
    itemLookupExpression,
    itemLookupGuard,
    itemNotFoundMessage,
    missingSelectorMessage,
    pageSelectorInputSchema,
} from "./site-scope.js";
import { RENDERING_LOOKUP_FUNCTIONS, renderingSelectorInputSchema, renderingLookupCall } from "./rendering-lookup.js";

/**
 * Creates the datasource item a component needs, in the place the CM says it belongs.
 *
 * This looks like domain intelligence and is not: the rendering item carries both facts.
 * The `RichText` rendering on a Stride site declares
 *
 *   Datasource Template = /sitecore/templates/Project/Stride/Components/Rich Text/Rich Text
 *   Datasource Location = query:$site/*[@@name='Data']/*[@@templatename='RichText Folder']
 *                        |query:$sharedSites/*[@@name='Data']/*[@@templatename='RichText Folder']
 *
 * So the whole job is: read the two fields, resolve the `query:` expression against the
 * context site, create an item of that template there, set the supplied fields.
 *
 * `Datasource Location` holds **pipe-separated candidates** — site-local first, then
 * shared. They are resolved in order and the first that exists wins. When none resolves
 * the tool fails naming every candidate it tried, because creating the item somewhere
 * plausible instead is exactly how orphaned content happens.
 *
 * Both placements are supported explicitly, because getting this wrong strands content:
 * `sitecore-marketer` was observed writing a populated datasource to the *shared* folder
 * with a hash-suffixed name while its own add-component tool created an empty page-local
 * item — leaving the authored content in an item nothing referenced, outside the page
 * subtree, where deleting the page would not clean it up. Page-local is the default here
 * because that is the convention the authored Stride pages use, and its layout reference
 * form (`local:/Data/<name>`) keeps the datasource inside the page it belongs to.
 */

const DESCRIPTION =
    "Creates the datasource item for a component, using the Datasource Template and "
    + "Datasource Location declared on the rendering itself. placement='page-local' "
    + "(default) creates <page>/Data/<name> and returns the layout reference form "
    + "'local:/Data/<name>' that authored pages use; placement='shared' resolves the "
    + "rendering's pipe-separated Datasource Location candidates in order and creates the "
    + "item in the first that exists, returning the item ID to reference it by. Fails "
    + "naming every candidate it tried when none resolves, rather than guessing at a "
    + "location. Pass the field values in 'fields' and they are set on the new item.";

const PLACEMENT_DESCRIPTION =
    "Where to create the datasource. 'page-local' (default) puts it under <page>/Data, "
    + "referenced from the layout as local:/Data/<name>, so it lives and dies with the "
    + "page. 'shared' puts it in the site Data folder that the rendering's Datasource "
    + "Location resolves to, for content reused across pages.";

const NAME_DESCRIPTION =
    "Name for the new item. Defaults to '<RenderingName> <n>' with the lowest free n, "
    + "which is the convention the authored pages use (e.g. 'RichText 1').";

/**
 * `Datasource Location` token substitution and candidate resolution.
 *
 * `$site` is the site root. `$sharedSites` is a Sitecore multisite setting that is not
 * present on every site — when it cannot be read the candidate is reported unresolved
 * rather than guessed at, which is the whole point of this tool.
 */
const DATASOURCE_LOCATION_FUNCTIONS = `
function Get-McpSharedSiteRoots {
    param([Sitecore.Data.Items.Item]$SiteRoot)

    if ($null -eq $SiteRoot) { return @() }
    $roots = @();
    foreach ($holder in @($SiteRoot, (Get-Item -Path ($SiteRoot.Database.Name + ':' + $SiteRoot.Paths.FullPath + '/Settings') -ErrorAction SilentlyContinue))) {
        if ($null -eq $holder) { continue }
        foreach ($fieldName in @('SharedSites', 'Shared sites')) {
            $field = $holder.Fields[$fieldName];
            if ($null -eq $field -or [string]::IsNullOrWhiteSpace($field.Value)) { continue }
            foreach ($token in @($field.Value -split '[|\\r\\n]' | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' })) {
                $shared = $null;
                try {
                    if ($token.StartsWith('{')) { $shared = Get-Item -Path ($holder.Database.Name + ':') -ID $token -ErrorAction SilentlyContinue }
                    else { $shared = Get-Item -Path ($holder.Database.Name + ':' + $token) -ErrorAction SilentlyContinue }
                } catch { $shared = $null }
                if ($null -ne $shared) { $roots += $shared.Paths.FullPath }
            }
        }
    }
    return @($roots | Select-Object -Unique);
}

function Resolve-McpDatasourceLocation {
    param([Sitecore.Data.Items.Item]$ContextItem, [Sitecore.Data.Items.Item]$SiteRoot, [string]$Location)

    $database = $ContextItem.Database.Name;
    $sitePath = $null;
    if ($null -ne $SiteRoot) { $sitePath = $SiteRoot.Paths.FullPath }
    $sharedPaths = @(Get-McpSharedSiteRoots -SiteRoot $SiteRoot);

    $attempts = New-Object System.Collections.ArrayList;
    foreach ($raw in @($Location -split '[|\\r\\n]' | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' })) {
        $query = $raw;
        if ($query.StartsWith('query:', [System.StringComparison]::OrdinalIgnoreCase)) { $query = $query.Substring(6) }

        # One candidate can expand to several concrete queries: $sharedSites is a list.
        $expanded = @();
        if ($query.Contains('$sharedSites')) {
            if ($sharedPaths.Count -eq 0) {
                [void]$attempts.Add([PSCustomObject]@{ Candidate = $raw; Query = $null; Note = 'the $sharedSites token could not be resolved: no SharedSites setting on this site'; ResolvedPath = $null });
                continue;
            }
            foreach ($shared in $sharedPaths) { $expanded += $query.Replace('$sharedSites', $shared) }
        }
        elseif ($query.Contains('$site')) {
            if ([string]::IsNullOrWhiteSpace($sitePath)) {
                [void]$attempts.Add([PSCustomObject]@{ Candidate = $raw; Query = $null; Note = 'the $site token could not be resolved: no site owns this item'; ResolvedPath = $null });
                continue;
            }
            $expanded += $query.Replace('$site', $sitePath);
        }
        elseif ($query.StartsWith('.')) {
            # Relative to the context item, which is how a non-tokenised location is read.
            $expanded += ($ContextItem.Paths.FullPath + $query.Substring(1));
        }
        else {
            $expanded += $query;
        }

        foreach ($concrete in $expanded) {
            $hit = $null;
            try { $hit = @(Get-Item -Path ($database + ':') -Query $concrete -ErrorAction SilentlyContinue) | Select-Object -First 1 } catch { $hit = $null }
            if ($null -eq $hit) {
                try { $hit = Get-Item -Path ($database + ':' + $concrete) -ErrorAction SilentlyContinue } catch { $hit = $null }
            }
            if ($null -ne $hit) {
                [void]$attempts.Add([PSCustomObject]@{ Candidate = $raw; Query = $concrete; Note = 'resolved'; ResolvedPath = $hit.Paths.FullPath });
                return [PSCustomObject]@{ Item = $hit; Query = $concrete; Candidate = $raw; Attempts = @($attempts) };
            }
            [void]$attempts.Add([PSCustomObject]@{ Candidate = $raw; Query = $concrete; Note = 'no item matched'; ResolvedPath = $null });
        }
    }

    return [PSCustomObject]@{ Item = $null; Query = $null; Candidate = $null; Attempts = @($attempts) };
}

function Get-McpNextDatasourceName {
    param([Sitecore.Data.Items.Item]$Parent, [string]$Stem)

    $taken = @{};
    foreach ($child in @(Get-ChildItem -Path ($Parent.Database.Name + ':' + $Parent.Paths.FullPath) -ErrorAction SilentlyContinue)) {
        $taken[$child.Name.ToLowerInvariant()] = 1;
    }
    $index = 1;
    while ($taken.ContainsKey(($Stem + ' ' + $index).ToLowerInvariant())) { $index++ }
    return $Stem + ' ' + $index;
}
`;

/**
 * Template candidates for the page-local `Data` folder, in order of preference.
 *
 * The SXA "Page Data" template is what authored Stride pages use, so it is tried first by
 * path and then by ID (the path moved between SXA versions). A CM without SXA falls back
 * to the plain folder template, which is functionally what the item is.
 */
const PAGE_DATA_TEMPLATE_CANDIDATES = `
$pageDataTemplate = $null;
foreach ($candidate in @('/sitecore/templates/Foundation/Experience Accelerator/Local Datasources/Page Data', '/sitecore/templates/Common/Folder')) {
    $pageDataTemplate = Get-Item -Path ($database + ':' + $candidate) -ErrorAction SilentlyContinue;
    if ($null -ne $pageDataTemplate) { break }
}
if ($null -eq $pageDataTemplate) {
    $pageDataTemplate = Get-Item -Path ($database + ':') -ID '{1C82E550-EBCD-4E5D-8ABD-D50D0809541E}' -ErrorAction SilentlyContinue;
}
`;

export function createComponentDatasourcePowershellTool(server: McpServer, config: Config) {
    server.registerTool(
        "create-component-datasource",
        {
            description: DESCRIPTION,
            inputSchema: {
                ...pageSelectorInputSchema,
                ...renderingSelectorInputSchema,
                placement: z.enum(["page-local", "shared"]).optional().describe(PLACEMENT_DESCRIPTION),
                name: z.string().optional().describe(NAME_DESCRIPTION),
                fields: z.record(z.string(), z.string()).optional()
                    .describe("Field values to set on the new item, keyed by Sitecore field name."),
            },
        },
        async (params) => {
            const lookup = itemLookupExpression(params);
            if (!lookup) {
                return { isError: true, content: [{ type: "text", text: missingSelectorMessage("pageId") }] };
            }

            const rendering = renderingLookupCall(params);
            if (!rendering) {
                return {
                    isError: true,
                    content: [{ type: "text", text: "Supply either 'renderingPath' or 'renderingId'." }],
                };
            }

            const pageLocal = (params.placement ?? "page-local") === "page-local";
            const fields = params.fields ?? {};
            const fieldNames = Object.keys(fields);

            // Field names are validated against the template before the item is created:
            // setting a field that does not exist is a silent no-op, and an agent that
            // believes it wrote content it did not write is worse than a failed call.
            const fieldValidation = fieldNames.length === 0
                ? ""
                : `
$requestedFields = @(${fieldNames.map(quotePowerShellString).join(", ")});
$templateDefinition = [Sitecore.Data.Managers.TemplateManager]::GetTemplate($template.ID, $template.Database);
$missingFields = @();
foreach ($fieldName in $requestedFields) {
    if ($null -eq $templateDefinition -or $null -eq $templateDefinition.GetField($fieldName)) { $missingFields += $fieldName }
}
if ($missingFields.Count -gt 0) {
    Write-Error ("The datasource template '" + $template.Paths.FullPath + "' has no field(s): " + ($missingFields -join ', ') + ". Nothing was created. Read the template's fields and retry with the correct names.");
    return;
}
`;

            const fieldAssignments = fieldNames.length === 0
                ? ""
                : `
[void]$created.Editing.BeginEdit();
${fieldNames.map((name) => `$created[${quotePowerShellString(name)}] = ${quotePowerShellString(fields[name])};`).join("\n")}
[void]$created.Editing.EndEdit();
$created = Get-Item -Path ($database + ':') -ID $created.ID.ToString();
`;

            const parentResolution = pageLocal
                ? `
${PAGE_DATA_TEMPLATE_CANDIDATES}
$parent = Get-Item -Path ($database + ':' + $page.Paths.FullPath + '/Data') -ErrorAction SilentlyContinue;
if ($null -eq $parent) {
    if ($null -eq $pageDataTemplate) {
        Write-Error 'No page Data folder exists and no template was found to create one (looked for the SXA Page Data template and /sitecore/templates/Common/Folder). Create the Data item manually, or use placement=shared.';
        return;
    }
    $parent = New-Item -Path ($database + ':' + $page.Paths.FullPath) -Name 'Data' -ItemType $pageDataTemplate.Paths.FullPath;
}
$placement = 'page-local';
$resolvedQuery = $null;
`
                : `
$location = $rendering['Datasource Location'];
if ([string]::IsNullOrWhiteSpace($location)) {
    Write-Error ("The rendering '" + $rendering.Name + "' declares no Datasource Location, so there is no shared folder to create the item in. Use placement=page-local, or set Datasource Location on the rendering.");
    return;
}
$resolution = Resolve-McpDatasourceLocation -ContextItem $page -SiteRoot (Get-McpSiteRoot -Item $page) -Location $location;
if ($null -eq $resolution.Item) {
    $detail = @();
    foreach ($attempt in $resolution.Attempts) {
        if ($null -eq $attempt.Query) { $detail += ("[" + $attempt.Candidate + "] -> " + $attempt.Note) }
        else { $detail += ("[" + $attempt.Candidate + "] as '" + $attempt.Query + "' -> " + $attempt.Note) }
    }
    Write-Error ("Datasource Location on rendering '" + $rendering.Name + "' resolved to nothing, so no datasource was created. Candidates tried in order: " + ($detail -join ' ; ') + ". Fix the Datasource Location on the rendering, create the target folder, or use placement=page-local.");
    return;
}
$parent = $resolution.Item;
$placement = 'shared';
$resolvedQuery = $resolution.Query;
`;

            const command = `
${SITE_SCOPE_FUNCTIONS}
${RENDERING_LOOKUP_FUNCTIONS}
${DATASOURCE_LOCATION_FUNCTIONS}
$page = ${lookup};
${itemLookupGuard("$page", itemNotFoundMessage("page"))}
$database = $page.Database.Name;
$rendering = ${rendering};
${itemLookupGuard("$rendering", "No rendering item was found for the supplied renderingPath or renderingId.")}
$templateReference = $rendering['Datasource Template'];
if ([string]::IsNullOrWhiteSpace($templateReference)) {
    Write-Error ("The rendering '" + $rendering.Name + "' declares no Datasource Template, so there is no template to create a datasource from. This rendering may not take a datasource at all — check whether it needs one before creating an item for it.");
    return;
}
$template = Get-McpItemByReference -Database $database -Reference $templateReference;
if ($null -eq $template) {
    Write-Error ("Datasource Template on rendering '" + $rendering.Name + "' is '" + $templateReference + "', which resolves to no item. Fix the rendering's Datasource Template field.");
    return;
}
${fieldValidation}
${parentResolution}
$name = ${params.name ? quotePowerShellString(params.name) : "Get-McpNextDatasourceName -Parent $parent -Stem $rendering.Name"};
$existing = Get-Item -Path ($database + ':' + $parent.Paths.FullPath + '/' + $name) -ErrorAction SilentlyContinue;
if ($null -ne $existing) {
    Write-Error ("An item named '" + $name + "' already exists at '" + $parent.Paths.FullPath + "'. Pass a different name, or omit name to get the next free '<RenderingName> <n>'.");
    return;
}
$created = New-Item -Path ($database + ':' + $parent.Paths.FullPath) -Name $name -ItemType $template.Paths.FullPath;
${fieldAssignments}
$reference = $created.ID.ToString();
if ($placement -eq 'page-local') {
    $reference = 'local:' + $created.Paths.FullPath.Substring($page.Paths.FullPath.Length);
}
[PSCustomObject]@{
    ID = $created.ID.ToString();
    Name = $created.Name;
    ItemPath = $created.Paths.FullPath;
    TemplateName = $created.TemplateName;
    Placement = $placement;
    ParentPath = $parent.Paths.FullPath;
    ResolvedQuery = $resolvedQuery;
    DatasourceReference = $reference;
};
`;

            return safeMcpResponse(runGenericPowershellCommand(config, command, {}));
        }
    );
}
