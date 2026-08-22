import { z } from "zod";
import { quotePowerShellString } from "./command-builder.js";

/**
 * Response projection for the item-returning PowerShell tools.
 *
 * Every PowerShell tool routes its output through `runGenericPowershellCommand`, which
 * hands the CLIXML→JSON conversion back verbatim. When the cmdlet emits a Sitecore
 * `Item` the CLIXML serializer expands the whole .NET object graph — `Access`,
 * `Appearance`, `Axes`, `Database`, `Fields`, `Paths`, `Statistics`, `Template`,
 * `Visualization`, … — and a single item by path measured over 250,000 characters
 * against a Stride content page. Almost none of it is information the calling agent
 * can act on.
 *
 * The fix is the discipline `indexing-find-item` already applies: append a
 * `Select-Object` projection to the command so Sitecore does the trimming before the
 * object is ever serialized. The default set is the identity an agent needs in order
 * to make its next call; `fields` adds named Sitecore fields on top, and `full`
 * disables projection entirely for the diagnostics that genuinely want the graph.
 */
export type ProjectedProperty = {
    /** Property name in the projected output. */
    name: string;
    /** PowerShell expression evaluated against `$_`. */
    expression: string;
};

/**
 * The default projection: the identity of an item, and nothing else.
 */
export const ITEM_PROJECTION: ProjectedProperty[] = [
    { name: "ID", expression: "$_.ID.ToString()" },
    { name: "Name", expression: "$_.Name" },
    { name: "ItemPath", expression: "$_.Paths.FullPath" },
    { name: "TemplateID", expression: "$_.TemplateID.ToString()" },
    { name: "TemplateName", expression: "$_.TemplateName" },
    { name: "Language", expression: "$_.Language.Name" },
    { name: "Version", expression: "$_.Version.Number" },
    { name: "HasChildren", expression: "$_.HasChildren" },
];

/**
 * `Get-ArchiveItem` emits `Sitecore.Data.Archiving.ArchiveEntry`, not an `Item`, so the
 * item projection above would return nothing but nulls. These are the archive entry's
 * own properties (verified by reflection against a live CM). There is no `fields`
 * counterpart here: an archive entry carries no Sitecore fields to project.
 */
export const ARCHIVE_ENTRY_PROJECTION: ProjectedProperty[] = [
    { name: "ArchivalId", expression: "$_.ArchivalId.ToString()" },
    { name: "ItemId", expression: "$_.ItemId.ToString()" },
    { name: "Name", expression: "$_.Name" },
    { name: "OriginalLocation", expression: "$_.OriginalLocation" },
    { name: "ArchiveName", expression: "$_.ArchiveName" },
    { name: "ArchiveDate", expression: "$_.ArchiveDate" },
    { name: "ArchivedBy", expression: "$_.ArchivedBy" },
];

const FIELDS_DESCRIPTION =
    "Additional Sitecore field names to include in the projected result "
    + "(e.g. ['Title', 'NavigationTitle']). Ignored when 'full' is true.";

const FULL_DESCRIPTION =
    "When true, skip projection and return the complete serialized object graph, and the "
    + "complete .NET error record on failure. Very large (100,000+ characters for a single "
    + "item) — only use it for diagnostics that need a property the projection omits.";

/**
 * Raw zod shape fragment to spread into the `inputSchema` of a tool that projects items.
 */
export const itemProjectionInputSchema = {
    fields: z.array(z.string()).optional().describe(FIELDS_DESCRIPTION),
    full: z.boolean().optional().describe(FULL_DESCRIPTION),
};

/**
 * Raw zod shape fragment for a tool that projects something other than an `Item`, where
 * a Sitecore `fields` list has no meaning.
 */
export const fullOnlyInputSchema = {
    full: z.boolean().optional().describe(FULL_DESCRIPTION),
};

/**
 * `Get-ItemTemplate` returns `TemplateItem` and `Get-LayoutDevice` returns `DeviceItem`;
 * both derive from `CustomItemBase` and wrap the real item in `InnerItem`. Unwrapping
 * them first lets one projection serve every item-returning cmdlet. A plain `Item` is
 * passed through untouched.
 */
const UNWRAP_CUSTOM_ITEM =
    " | ForEach-Object { if ($_ -is [Sitecore.Data.Items.CustomItemBase]) { $_.InnerItem } else { $_ } }";

/**
 * Renders a `Select-Object` stage (including the leading pipe) for the given properties.
 */
export function selectObjectPipeline(properties: ProjectedProperty[]): string {
    const calculated = properties
        .map((p) => `@{n=${quotePowerShellString(p.name)}; e={${p.expression}}}`)
        .join(", ");
    return ` | Select-Object ${calculated}`;
}

/**
 * Builds the pipeline to append to an item-returning command, or `undefined` when the
 * caller asked for the unprojected output.
 */
export function itemProjectionPipeline(params: { fields?: string[]; full?: boolean }): string | undefined {
    if (params.full) {
        return undefined;
    }

    const taken = new Set(ITEM_PROJECTION.map((p) => p.name.toLowerCase()));
    const extra: ProjectedProperty[] = [];
    for (const field of params.fields ?? []) {
        const name = String(field).trim();
        if (!name || taken.has(name.toLowerCase())) {
            continue;
        }
        taken.add(name.toLowerCase());
        // The Item indexer returns the raw field value as a string.
        extra.push({ name, expression: `$_[${quotePowerShellString(name)}]` });
    }

    return UNWRAP_CUSTOM_ITEM + selectObjectPipeline([...ITEM_PROJECTION, ...extra]);
}

/**
 * Builds the pipeline for a fixed projection (no `fields` support), or `undefined` when
 * the caller asked for the unprojected output.
 */
export function fixedProjectionPipeline(
    properties: ProjectedProperty[],
    params: { full?: boolean }
): string | undefined {
    return params.full ? undefined : selectObjectPipeline(properties);
}
