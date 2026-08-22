import type { McpServer } from "@modelcontextprotocol/server";
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
    requireOneSelector,
    pageSelectorInputSchema,
} from "./site-scope.js";
import {
    PLACEHOLDER_SETTINGS_FUNCTIONS,
    PLACEHOLDER_PATH_DESCRIPTION,
    PROJECT_DESCRIPTION,
} from "./placeholder-settings.js";
import { RENDERING_LOOKUP_FUNCTIONS, renderingSelectorInputSchema, renderingLookupCall, requireOneRenderingSelector } from "./rendering-lookup.js";
import { RENDERING_PARAMETER_FUNCTIONS } from "./rendering-parameters.js";

/**
 * A composition-aware wrapper over `presentation-add-rendering`, which today writes
 * whatever it is told.
 *
 * Three things it adds:
 *
 * **It validates.** A rendering the target placeholder forbids is refused, with the
 * allow-list in the message so the caller's next call can be right. `force: true` is the
 * deliberate override — migration and repair work legitimately needs it — but validation
 * is the default, because the failure it prevents is invisible: the invalid layout saves,
 * renders, and passes every field-level check.
 *
 * **It assigns `DynamicPlaceholderId`.** A rendering whose children go in its own
 * placeholder needs one, and it must not collide with an ID the page already uses. Every
 * `DynamicPlaceholderId=<n>` parameter and every `-<n>` segment suffix in an existing
 * placeholder path is scanned, across both the shared and the final layout, and the new
 * rendering gets max+1. Only renderings whose parameters template actually defines the
 * field get one — which is why an authored `RichText` never carries one and an authored
 * `Container` always does.
 *
 * **It writes the full parameter set.** Every key the rendering's parameters template
 * defines, empty where there is no value, which is how Sitecore itself writes them. See
 * `rendering-parameters.ts` for which fields are excluded and why.
 */

const DESCRIPTION =
    "Adds a rendering to a placeholder on a page, refusing it when the placeholder's "
    + "settings do not allow that component (the allow-list is named in the error). This "
    + "is the tool to compose a page with: presentation-add-rendering writes "
    + "whatever it is told, and an invalid layout still saves and renders. Assigns a "
    + "collision-free DynamicPlaceholderId when the rendering's parameters template "
    + "defines one, and writes the full parameter set the template declares. Returns the "
    + "placeholder path a child rendering should target, so a nested build is one call per "
    + "level. Pass force=true to skip validation for migration or repair work.";

const FORCE_DESCRIPTION =
    "Skip the placeholder-settings check and add the rendering anyway. For migration and "
    + "repair work that legitimately has to write a layout the current settings forbid. "
    + "The rendering item must still exist.";

const DATASOURCE_DESCRIPTION =
    "The rendering's datasource. Use the local:/Data/<name> form for a page-local "
    + "datasource, or an item ID for a shared one — create-component-datasource returns "
    + "the correct form in DatasourceReference.";

const PARAMETERS_DESCRIPTION =
    "Values for the rendering's parameters, keyed by parameter name (e.g. "
    + "{'GridParameters': '{F38CFEF8-...}'}). Every key the parameters template defines is "
    + "written whether or not it appears here; these are the ones that get a value. Names "
    + "not defined by the template are rejected rather than written.";

const FINAL_LAYOUT_DESCRIPTION =
    "Which layout to write. Defaults to true (the final layout), which is where authored "
    + "pages carry their renderings. Set false to write the shared layout.";

const DYNAMIC_PLACEHOLDER_ID_DESCRIPTION =
    "Force a specific DynamicPlaceholderId instead of the scanned max+1. Only use this to "
    + "reproduce an exact layout; a colliding ID silently merges two placeholders.";

export function addRenderingToPlaceholderPowershellTool(server: McpServer, config: Config) {
    server.registerTool(
        "add-rendering-to-placeholder",
        {
            description: DESCRIPTION,
            inputSchema: z.object({
                ...pageSelectorInputSchema,
                ...renderingSelectorInputSchema,
                placeholder: z.string().describe(
                    `The placeholder to add the rendering to. ${PLACEHOLDER_PATH_DESCRIPTION} `
                    + "Use the exact runtime path for a nested placeholder — that is what gets written "
                    + "to the layout."
                ),
                dataSource: z.string().optional().describe(DATASOURCE_DESCRIPTION),
                parameters: z.record(z.string(), z.string()).optional().describe(PARAMETERS_DESCRIPTION),
                dynamicPlaceholderId: z.number().optional().describe(DYNAMIC_PLACEHOLDER_ID_DESCRIPTION),
                index: z.number().optional().describe("Position to insert at within the placeholder. Appends by default."),
                finalLayout: z.boolean().optional().describe(FINAL_LAYOUT_DESCRIPTION),
                force: z.boolean().optional().describe(FORCE_DESCRIPTION),
                project: z.string().optional().describe(PROJECT_DESCRIPTION),
            }),
        },
        async (params) => {
            const ambiguousPage = requireOneSelector(params, "pageId");
            if (ambiguousPage) {
                return ambiguousPage;
            }
            const lookup = itemLookupExpression(params);
            if (!lookup) {
                return { isError: true, content: [{ type: "text", text: missingSelectorMessage("pageId") }] };
            }

            const ambiguousRendering = requireOneRenderingSelector(params);
            if (ambiguousRendering) {
                return ambiguousRendering;
            }
            const rendering = renderingLookupCall(params);
            if (!rendering) {
                return {
                    isError: true,
                    content: [{ type: "text", text: "Supply either 'renderingPath' or 'renderingId'." }],
                };
            }

            const finalLayout = params.finalLayout !== false;
            const parameterValues = params.parameters ?? {};
            const parameterNames = Object.keys(parameterValues);

            const parameterHashtable = parameterNames.length === 0
                ? "@{}"
                : `@{ ${parameterNames
                    .map((name) => `${quotePowerShellString(name)} = ${quotePowerShellString(parameterValues[name])}`)
                    .join("; ")} }`;

            // Validation is a plain early return, not an exception, so the refusal message
            // reaches the agent intact over the SPE remoting transport (see
            // presentation/rendering-guard.ts).
            const validation = params.force
                ? "$validation = $null;\n"
                : `
$validation = Get-McpAllowedComponents -Item $page -PlaceholderPath ${quotePowerShellString(params.placeholder)} -Project ${quotePowerShellString(params.project ?? "")};
if ($null -eq $validation) { return }
if (-not $validation.Found) {
    Write-Error ("No placeholder settings item governs the placeholder key '" + $validation.PlaceholderKeyRequested + "', so what it allows is unknown — most often that means the key is misspelled. Searched: " + (@($validation.ScopesSearched) -join ', ') + ". Use get-allowed-components-by-placeholder to find the right key, or pass force=true to add the rendering anyway.");
    return;
}
if (@($validation.Allowed | ForEach-Object { $_.ID }) -notcontains $rendering.ID.ToString()) {
    $allowedText = @($validation.Allowed | ForEach-Object { $_.Name + ' ' + $_.ID });
    if ($allowedText.Count -eq 0) { $allowedText = @('(none — this placeholder allows no components at all)') }
    Write-Error ("The placeholder '" + $validation.PlaceholderKey + "' does not allow the rendering '" + $rendering.Name + "' " + $rendering.ID.ToString() + ". Settings item: " + $validation.SettingsItemPath + " (" + $validation.Scope + "-level). Allowed here: " + ($allowedText -join '; ') + ". Add one of those instead, or pass force=true if you intend to write a layout the placeholder settings forbid.");
    return;
}
`;

            const command = `
${SITE_SCOPE_FUNCTIONS}
${PLACEHOLDER_SETTINGS_FUNCTIONS}
${RENDERING_LOOKUP_FUNCTIONS}
${RENDERING_PARAMETER_FUNCTIONS}
$page = ${lookup};
${itemLookupGuard("$page", itemNotFoundMessage("page"))}
$database = $page.Database.Name;
$rendering = ${rendering};
${itemLookupGuard("$rendering", "No rendering item was found for the supplied renderingPath or renderingId.")}
${validation}
$parameterKeys = @(Get-McpRenderingParameterKeys -Rendering $rendering);
$suppliedValues = ${parameterHashtable};
$unknownParameters = @();
foreach ($supplied in $suppliedValues.Keys) {
    if ($parameterKeys -notcontains $supplied) { $unknownParameters += $supplied }
}
if ($unknownParameters.Count -gt 0) {
    Write-Error ("The rendering '" + $rendering.Name + "' has no parameter(s): " + ($unknownParameters -join ', ') + ". Nothing was added. Its parameters template defines: " + ($parameterKeys -join ', ') + ".");
    return;
}
# Scanned before the write, so the max reflects the layout the caller is adding to.
$nextDynamicId = 0;
if ($parameterKeys -contains 'DynamicPlaceholderId') { $nextDynamicId = Get-McpNextDynamicPlaceholderId -Item $page }
$existingUniqueIds = @{};
foreach ($existing in @(Get-Rendering -Item $page${finalLayout ? " -FinalLayout" : ""} -ErrorAction SilentlyContinue)) {
    if (-not [string]::IsNullOrWhiteSpace($existing.UniqueId)) { $existingUniqueIds[$existing.UniqueId] = 1 }
}
$instance = New-Rendering -Item $rendering -PlaceHolder ${quotePowerShellString(params.placeholder)};
if ($null -eq $instance) {
    Write-Error ("New-Rendering returned nothing for '" + $rendering.Paths.FullPath + "'. Verify the item is a rendering definition item.");
    return;
}
${params.dataSource ? `$instance.Datasource = ${quotePowerShellString(params.dataSource)};` : ""}
Add-Rendering -Item $page -Instance $instance -PlaceHolder ${quotePowerShellString(params.placeholder)}${finalLayout ? " -FinalLayout" : ""}${params.index !== undefined ? ` -Index ${Number(params.index)}` : ""};
# Identify what was written by diffing UniqueIds rather than by trusting the one on
# the definition object: Add-Rendering assigns the UniqueId as it writes, so the
# instance handed to it does not carry the value that ends up in the layout.
$page = Get-Item -Path ($database + ':') -ID $page.ID.ToString();
$written = @(Get-Rendering -Item $page${finalLayout ? " -FinalLayout" : ""} -ErrorAction SilentlyContinue |
    Where-Object { -not $existingUniqueIds.ContainsKey($_.UniqueId) }) | Select-Object -Last 1;
if ($null -eq $written) {
    Write-Error ("Add-Rendering reported no error but the rendering is not on the item. Read the page with presentation-list-renderings and retry.");
    return;
}
# Add-Rendering ignores the Parameters on the instance it is handed and the CM writes
# its own set instead, so the parameters are applied here, on top of what the CM wrote.
# See rendering-parameters.ts for the verification behind that.
$platformParameters = $written.Parameters;
$platformDynamicId = Get-McpParameterValue -Parameters $platformParameters -ParameterName 'DynamicPlaceholderId';
$dynamicId = 0;
$dynamicIdSource = 'none';
${params.dynamicPlaceholderId !== undefined
    ? `$dynamicId = ${Number(params.dynamicPlaceholderId)};
$dynamicIdSource = 'caller';`
    : `if (-not [string]::IsNullOrWhiteSpace($platformDynamicId)) {
    # The CM assigned one as it wrote, after the add, so it is at least as current as the
    # pre-write scan. Keep it.
    $dynamicId = [int]$platformDynamicId;
    $dynamicIdSource = 'platform';
}
elseif ($nextDynamicId -gt 0) {
    $dynamicId = $nextDynamicId;
    $dynamicIdSource = 'computed';
}`}
$desiredParameters = Get-McpMergedRenderingParameters -Existing $platformParameters -Keys $parameterKeys -Values $suppliedValues -DynamicPlaceholderId $dynamicId;

# Only write when the change carries information: a value the caller asked for, or a
# dynamic id the CM did not assign itself. Adding valueless keys the CM chose to omit
# only fights the platform, which drops a parameter string in which every key is empty --
# which is exactly why authored RichText instances have no par attribute at all.
$needsParameterWrite = $false;
if ($desiredParameters -ne $platformParameters) {
    if ($suppliedValues.Count -gt 0) { $needsParameterWrite = $true }
    if ($dynamicId -gt 0 -and $dynamicIdSource -ne 'platform') { $needsParameterWrite = $true }
}
if ($needsParameterWrite) {
    $written.Parameters = $desiredParameters;
    Set-Rendering -Item $page -Instance $written${finalLayout ? " -FinalLayout" : ""};
    $page = Get-Item -Path ($database + ':') -ID $page.ID.ToString();
    $reread = @(Get-Rendering -Item $page${finalLayout ? " -FinalLayout" : ""} -ErrorAction SilentlyContinue |
        Where-Object { $_.UniqueId -eq $written.UniqueId }) | Select-Object -First 1;
    if ($null -ne $reread) { $written = $reread }
}

# Every value the caller asked for has to be readable back off the layout. A parameter
# that silently failed to persist leaves the agent believing it configured a component it
# did not configure.
$missingParameters = @();
foreach ($key in @($suppliedValues.Keys)) {
    if ((Get-McpParameterValue -Parameters $written.Parameters -ParameterName $key) -ne [string]$suppliedValues[$key]) { $missingParameters += $key }
}
if ($dynamicId -gt 0 -and (Get-McpParameterValue -Parameters $written.Parameters -ParameterName 'DynamicPlaceholderId') -ne [string]$dynamicId) {
    $missingParameters += 'DynamicPlaceholderId';
}
if ($missingParameters.Count -gt 0) {
    Write-Error ("The rendering was added but these parameters did not persist: " + ($missingParameters -join ', ') + ". The layout holds '" + $written.Parameters + "'. Read the page with presentation-list-renderings before writing again.");
    return;
}
$childPlaceholder = Get-McpChildPlaceholder -Item $page -Rendering $rendering -ParentPlaceholder $written.Placeholder -DynamicPlaceholderId $dynamicId -Project ${quotePowerShellString(params.project ?? "")};
[PSCustomObject]@{
    Placeholder = $written.Placeholder;
    RenderingName = $rendering.Name;
    RenderingID = $rendering.ID.ToString();
    UniqueId = $written.UniqueId;
    Datasource = $written.Datasource;
    Parameters = $written.Parameters;
    DynamicPlaceholderId = $dynamicId;
    DynamicPlaceholderIdSource = $dynamicIdSource;
    ChildPlaceholder = $childPlaceholder;
    FinalLayout = ${finalLayout ? "$true" : "$false"};
    Validated = ${params.force ? "$false" : "$true"};
};
`;

            return safeMcpResponse(runGenericPowershellCommand(config, command, {}));
        }
    );
}
