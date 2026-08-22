import { z } from "zod";
import { quotePowerShellString } from "../../command-builder.js";

/**
 * Addressing a rendering definition item, and resolving the item references its fields
 * hold.
 *
 * Rendering fields point at other items in two interchangeable forms: a full path
 * (`Datasource Template` on the Stride `RichText` rendering is a path) and an ID
 * (`Parameters Template` is an ID). Both appear on the same item, so anything reading
 * these fields has to accept either.
 */
export const RENDERING_LOOKUP_FUNCTIONS = `
function Get-McpItemByReference {
    param([string]$Database, [string]$Reference)

    if ([string]::IsNullOrWhiteSpace($Reference)) { return $null }
    $trimmed = $Reference.Trim();
    try {
        if ($trimmed.StartsWith('{')) { return Get-Item -Path ($Database + ':') -ID $trimmed -ErrorAction SilentlyContinue }
        return Get-Item -Path ($Database + ':' + $trimmed) -ErrorAction SilentlyContinue;
    }
    catch { return $null }
}
`;

export const renderingSelectorInputSchema = {
    renderingPath: z.string().optional()
        .describe("Path of the rendering definition item (e.g. /sitecore/layout/Renderings/Project/Stride/RichText). Supply this or renderingId."),
    renderingId: z.string().optional()
        .describe("ID of the rendering definition item (e.g. {AD10DB7C-C944-42D9-9563-1F1070CC922E}). Supply this or renderingPath."),
};

export type RenderingSelector = {
    renderingPath?: string;
    renderingId?: string;
    database?: string;
    path?: string;
};

/**
 * The `Get-Item` expression for the rendering definition item, or `undefined` when the
 * caller supplied neither identifier.
 *
 * The rendering is read from the same database as the page (`$database`), which the
 * calling script has already established.
 */
export function renderingLookupCall(selector: RenderingSelector): string | undefined {
    if (selector.renderingPath) {
        const path = selector.renderingPath.includes(":")
            ? quotePowerShellString(selector.renderingPath)
            : `($database + ':' + ${quotePowerShellString(selector.renderingPath)})`;
        return `Get-Item -Path ${path} -ErrorAction SilentlyContinue`;
    }
    if (selector.renderingId) {
        return `Get-Item -Path ($database + ':') -ID ${quotePowerShellString(selector.renderingId)} -ErrorAction SilentlyContinue`;
    }
    return undefined;
}
