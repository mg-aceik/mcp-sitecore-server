/**
 * Rendering parameters, dynamic placeholder IDs, and the child placeholder a rendering
 * exposes.
 *
 * **The parameter set.** Sitecore writes every key a rendering's parameters template
 * defines, empty where there is no value, which is why an authored `PageSection` carries
 * `GridParameters=…&SectionTitle&AriaLabel&FieldNames&Styles&RenderingIdentifier&CSSStyles&DynamicPlaceholderId=1`
 * and not just the two keys that have values. The keys come from `TemplateManager`'s
 * resolved field list — the template's *own* fields are usually empty, and everything
 * useful arrives through base templates (`IStyling`, `IComponentVariant`, `Grid
 * Parameters`, `IRenderingId`, `IDynamicPlaceholder`).
 *
 * Three fields are excluded, matching what Sitecore itself writes: `Data Source`,
 * `Placeholder` and `Additional Parameters`. All three come from the `Standard Rendering
 * Parameters` base template and are represented elsewhere in the layout — the datasource
 * and placeholder are attributes of the rendering, not parameters of it. `CSSStyles`
 * comes from the same base template and *is* written, so this is a name list rather than
 * a "skip that base template" rule.
 *
 * **`DynamicPlaceholderId` is not written unconditionally.** It is written only when the
 * parameters template defines it, which is exactly the observed behaviour on authored
 * pages: `Container` and `PageSection` always carry one, `RichText` never does. It goes
 * last, which is where authored pages put it.
 *
 * **Values are encoded with `EscapeDataString`**, not `UrlEncode`: the authored parameter
 * strings encode a space as `%20` and a pipe as `%7C`, which is `EscapeDataString`'s
 * output, not `UrlEncode`'s `+`. Parameter *names* are written raw, as authored pages do.
 *
 * **`Add-Rendering` discards the `Parameters` on the instance it is given.** Verified
 * against a live SitecoreAI CM: `New-Rendering` produces a `RenderingDefinition`, setting
 * `.Parameters` on it sticks, `Add-Rendering -Instance` reports success — and the layout
 * comes back with a completely different parameter string (and a different `UniqueId`).
 * What lands is the CM's own work: it writes the full parameter key set from the
 * rendering's parameters template, in the same order authored pages use, and assigns a
 * non-colliding `DynamicPlaceholderId` itself. A rendering whose template has no
 * `DynamicPlaceholderId` field gets no `par` attribute at all, which is exactly why
 * authored `RichText` instances carry no parameters.
 *
 * So the parameter set is applied in a second step, with `Set-Rendering` (which *does*
 * honour `Parameters` on the instance), and only when the merge below actually changes
 * something. The CM's own string is the starting point when there is one — it is the
 * authored form — and the merge overlays the caller's values on top of it. Writing
 * blindly would throw away both the CM's key order and its dynamic-placeholder
 * assignment; skipping the step would silently drop every value the caller passed, which
 * is the worse failure of the two.
 *
 * One thing deliberately **not** done: no value is invented for `GridParameters`.
 * Sitecore Pages fills it with a grid class item drawn from the site's grid definition
 * (`.../Aceik Tailwind Grid Definition/Extra Small/Gap/Default` on the sampled site),
 * which is a Pages behaviour driven by editor configuration rather than anything readable
 * off the rendering. Guessing at it would be inventing presentation; the key is written
 * empty and the caller can pass a value through `parameters`.
 */
export const RENDERING_PARAMETER_FUNCTIONS = `
function Get-McpRenderingParameterKeys {
    param([Sitecore.Data.Items.Item]$Rendering)

    $reference = $Rendering['Parameters Template'];
    if ([string]::IsNullOrWhiteSpace($reference)) { return @() }
    $template = Get-McpItemByReference -Database $Rendering.Database.Name -Reference $reference;
    if ($null -eq $template) { return @() }
    $definition = [Sitecore.Data.Managers.TemplateManager]::GetTemplate($template.ID, $template.Database);
    if ($null -eq $definition) { return @() }

    # Represented as rendering attributes rather than parameters. See the docblock.
    $excluded = @('Data Source', 'Placeholder', 'Additional Parameters');
    $keys = @();
    $hasDynamicPlaceholderId = $false;
    foreach ($field in $definition.GetFields()) {
        $name = $field.Name;
        if ($name.StartsWith('__')) { continue }
        if ($excluded -contains $name) { continue }
        if ($name -eq 'DynamicPlaceholderId') { $hasDynamicPlaceholderId = $true; continue }
        if ($keys -notcontains $name) { $keys += $name }
    }
    if ($hasDynamicPlaceholderId) { $keys += 'DynamicPlaceholderId' }
    return $keys;
}

function Get-McpParameterValue {
    param([string]$Parameters, [string]$ParameterName)

    # $pairName, not $name: PowerShell variable names are case-insensitive, so a local
    # $name would BE the $Name parameter and every comparison against it would be true.
    if ([string]::IsNullOrWhiteSpace($Parameters)) { return $null }
    foreach ($pair in ($Parameters -split '&')) {
        if ([string]::IsNullOrWhiteSpace($pair)) { continue }
        $separator = $pair.IndexOf('=');
        if ($separator -lt 0) { continue }
        $pairName = [System.Uri]::UnescapeDataString($pair.Substring(0, $separator));
        if ($pairName -eq $ParameterName) { return [System.Uri]::UnescapeDataString($pair.Substring($separator + 1)) }
    }
    return $null;
}

function Get-McpMergedRenderingParameters {
    param([string]$Existing, [string[]]$Keys, [hashtable]$Values, [int]$DynamicPlaceholderId)

    # Key order comes from the existing string when there is one, because that is the CM's
    # own order and it matches authored pages. Template keys the existing string is missing
    # are appended, which is also the whole string when there is no existing one.
    $ordered = New-Object System.Collections.ArrayList;
    $current = @{};
    if (-not [string]::IsNullOrWhiteSpace($Existing)) {
        foreach ($pair in ($Existing -split '&')) {
            if ([string]::IsNullOrWhiteSpace($pair)) { continue }
            $separator = $pair.IndexOf('=');
            if ($separator -lt 0) { $pairName = [System.Uri]::UnescapeDataString($pair); $pairValue = '' }
            else {
                $pairName = [System.Uri]::UnescapeDataString($pair.Substring(0, $separator));
                $pairValue = [System.Uri]::UnescapeDataString($pair.Substring($separator + 1));
            }
            if (-not $ordered.Contains($pairName)) { [void]$ordered.Add($pairName) }
            $current[$pairName] = $pairValue;
        }
    }
    foreach ($key in $Keys) {
        if (-not $ordered.Contains($key)) { [void]$ordered.Add($key); $current[$key] = '' }
    }
    if ($null -ne $Values) {
        foreach ($key in @($Values.Keys)) { $current[$key] = [string]$Values[$key] }
    }
    if ($DynamicPlaceholderId -gt 0 -and $ordered.Contains('DynamicPlaceholderId')) {
        $current['DynamicPlaceholderId'] = [string]$DynamicPlaceholderId;
    }

    $pairs = @();
    foreach ($key in $ordered) {
        $value = [string]$current[$key];
        if ([string]::IsNullOrEmpty($value)) { $pairs += $key }
        else { $pairs += ($key + '=' + [System.Uri]::EscapeDataString($value)) }
    }
    return ($pairs -join '&');
}

function Get-McpNextDynamicPlaceholderId {
    param([Sitecore.Data.Items.Item]$Item)

    $max = 0;
    # Both layouts: a dynamic ID has to be unique across the page's effective
    # presentation, and a shared-layout rendering is part of that.
    foreach ($useFinalLayout in @($true, $false)) {
        $renderings = @();
        if ($useFinalLayout) { $renderings = @(Get-Rendering -Item $Item -FinalLayout -ErrorAction SilentlyContinue) }
        else { $renderings = @(Get-Rendering -Item $Item -ErrorAction SilentlyContinue) }
        foreach ($rendering in $renderings) {
            if (-not [string]::IsNullOrWhiteSpace($rendering.Parameters)) {
                foreach ($match in [System.Text.RegularExpressions.Regex]::Matches($rendering.Parameters, 'DynamicPlaceholderId=(\\d+)')) {
                    $value = [int]$match.Groups[1].Value;
                    if ($value -gt $max) { $max = $value }
                }
            }
            # A placeholder path carries the IDs of every rendering above it, e.g.
            # /headless-main/page-section-3/container-4, so the suffixes are IDs in use
            # even when the rendering that owns them is not on this item's layout.
            if (-not [string]::IsNullOrWhiteSpace($rendering.Placeholder)) {
                foreach ($match in [System.Text.RegularExpressions.Regex]::Matches($rendering.Placeholder, '-(\\d+)(?=/|$)')) {
                    $value = [int]$match.Groups[1].Value;
                    if ($value -gt $max) { $max = $value }
                }
            }
        }
    }
    return $max + 1;
}

function Get-McpKebabCase {
    param([string]$Value)

    if ([string]::IsNullOrWhiteSpace($Value)) { return '' }
    $builder = New-Object System.Text.StringBuilder;
    $previousWasLower = $false;
    foreach ($character in $Value.ToCharArray()) {
        if ($character -eq ' ' -or $character -eq '_') {
            [void]$builder.Append('-');
            $previousWasLower = $false;
            continue;
        }
        if ([char]::IsUpper($character)) {
            if ($previousWasLower) { [void]$builder.Append('-') }
            [void]$builder.Append([char]::ToLowerInvariant($character));
            $previousWasLower = $false;
            continue;
        }
        [void]$builder.Append($character);
        $previousWasLower = $true;
    }
    return $builder.ToString();
}

function Get-McpChildPlaceholder {
    param(
        [Sitecore.Data.Items.Item]$Item,
        [Sitecore.Data.Items.Item]$Rendering,
        [string]$ParentPlaceholder,
        [int]$DynamicPlaceholderId,
        [string]$Project
    )

    if ($DynamicPlaceholderId -le 0) { return $null }

    # Which placeholder a rendering renders is in the head's code, not the CM, so the
    # name is derived from the rendering name and then *verified* against a placeholder
    # settings item. No settings item matching '<kebab>-{*}' means no claim is made.
    $key = (Get-McpKebabCase -Value $Rendering.Name) + '-' + $DynamicPlaceholderId;
    $match = Resolve-McpPlaceholderSettings -Item $Item -PlaceholderPath $key -Project $Project;
    if ($null -eq $match -or $null -eq $match.SettingsItem) { return $null }
    if ($match.MatchType -ne 'wildcard') { return $null }

    $parent = $ParentPlaceholder;
    if ([string]::IsNullOrWhiteSpace($parent)) { return '/' + $key }
    if (-not $parent.StartsWith('/')) { $parent = '/' + $parent }
    return $parent.TrimEnd('/') + '/' + $key;
}
`;
