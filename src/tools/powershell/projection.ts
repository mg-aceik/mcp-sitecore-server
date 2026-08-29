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
 *
 * Every projection below exists because a live call was measured and found to be
 * unusable, not because a graph looked large. No cmdlet is projected speculatively: the
 * measurements are on a live SitecoreAI CM, before → after, and each is recorded on the
 * projection it justifies.
 *
 *   provider-get-item-by-path              252,351 →   247
 *   common-get-cache (no arguments)        110,299 → 26,332
 *   common-get-item-template-by-path       106,602 →   277
 *   provider-get-item-by-id                 65,215 →   238
 *   common-new-item-clone                   59,587 →   270
 *   security-lock-item (passThru)          ~51,000 →   260
 *   common-add-item-version                 47,459 →   260
 *   common-get-sitecore-job (no arguments)  42,018 → 8,920
 *   presentation-get-layout-by-path         35,573 →   285
 *   common-get-database (all databases)     21,761 →   642
 *   common-get-archive                       8,265 →    84
 *   presentation-get-default-layout-device   6,125 →   246
 *   security-get-role-member                 4,919 →   233
 *   security-get-current-user                4,466 →   253
 *   security-get-user-by-identity            3,385 →   233
 *   security-get-domain                      2,051 →   745
 *   security-get-item-acl                  756/rule → ~120/rule
 *
 * The three at the bottom of that list — domain, and the account reads — are the marginal
 * ones, and they are projected for consistency rather than for the saving: a caller that
 * has learned `full: true` on one account tool should not find the next one behaves
 * differently. `cache` and `job` are the opposite case: both take no useful arguments, so
 * before this there was no way for a caller to ask either for less than a fifth of a
 * 128k context window.
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

/**
 * `Get-SearchIndex` emits `SolrSearchIndex`, whose serialized graph carries its
 * `Configuration`, `Crawlers`, `Schema`, `PropertyStore` and `UpdateStrategies` — 5,500
 * characters for one index, and over 40,000 for the whole set.
 *
 * `IndexingState` and the `Summary` health flags are projected deliberately: the tool
 * used to offer `running` and `corrupted` switches that SPE's cmdlet has no parameters
 * for, so every call using them failed. Returning the facts as fields lets the caller
 * filter locally, which is what those switches were reaching for.
 *
 * The `Summary` fields are carried but not trusted. On an XM Cloud CM every index shares
 * one Solr core, and there `NumberOfDocuments` reads 0 and `IsHealthy` false on an index
 * that answers queries correctly -- verified live, with `indexing-find-item` and
 * `authoring-search` both returning results against an index reporting zero documents.
 * `IndexingState` is the field to believe; the tool's description says so.
 */
export const SEARCH_INDEX_PROJECTION: ProjectedProperty[] = [
    { name: "Name", expression: "$_.Name" },
    { name: "Core", expression: "$_.Core" },
    { name: "IndexingState", expression: "$_.IndexingState.ToString()" },
    { name: "IsInitialized", expression: "$_.IsInitialized" },
    { name: "IsSharded", expression: "$_.IsSharded" },
    { name: "NumberOfDocuments", expression: "$_.Summary.NumberOfDocuments" },
    { name: "IsHealthy", expression: "$_.Summary.IsHealthy" },
    { name: "IsClean", expression: "$_.Summary.IsClean" },
    { name: "OutOfDateIndex", expression: "$_.Summary.OutOfDateIndex" },
    { name: "LastUpdated", expression: "$_.Summary.LastUpdated" },
];

/**
 * `Get-Cache` with no name returns every cache in the instance. Unprojected that measured
 * 110,299 characters — around 27,000 tokens, a fifth of a 128k context window for a call
 * whose own description invites the no-argument form ("If not provided, all caches will
 * be returned"). The interesting part of a cache is its size and occupancy.
 */
export const CACHE_PROJECTION: ProjectedProperty[] = [
    { name: "Name", expression: "$_.Name" },
    { name: "Count", expression: "$_.Count" },
    { name: "Size", expression: "$_.Size" },
    { name: "MaxSize", expression: "$_.MaxSize" },
    { name: "RemainingSpace", expression: "$_.RemainingSpace" },
    { name: "Enabled", expression: "$_.Enabled" },
    { name: "Scavengable", expression: "$_.Scavengable" },
];

/**
 * `Get-SitecoreJob` takes no arguments at all, so there was no way to ask for less than
 * the 42,018 characters it returned: every job with its `Options`, `MessageQueue` and
 * `WaitHandle` expanded. The job's identity and progress live on `Status`, which is
 * flattened here so a caller can see state without a second call.
 */
export const JOB_PROJECTION: ProjectedProperty[] = [
    { name: "Name", expression: "$_.Name" },
    { name: "Category", expression: "$_.Category" },
    { name: "Handle", expression: "$_.Handle.ToString()" },
    { name: "IsDone", expression: "$_.IsDone" },
    { name: "State", expression: "$_.Status.State.ToString()" },
    { name: "Processed", expression: "$_.Status.Processed" },
    { name: "Total", expression: "$_.Status.Total" },
    { name: "Failed", expression: "$_.Status.Failed" },
    { name: "QueueTime", expression: "$_.QueueTime" },
];

/**
 * `Get-Database` expands `Caches`, `Engines`, `DataManager`, `Templates` and the rest —
 * 8,258 characters for one database and 21,761 for all of them.
 */
export const DATABASE_PROJECTION: ProjectedProperty[] = [
    { name: "Name", expression: "$_.Name" },
    { name: "ConnectionStringName", expression: "$_.ConnectionStringName" },
    { name: "Languages", expression: "($_.Languages | ForEach-Object { $_.Name }) -join ','" },
    { name: "ArchiveNames", expression: "$_.ArchiveNames -join ','" },
    { name: "ReadOnly", expression: "$_.ReadOnly" },
    { name: "Protected", expression: "$_.Protected" },
    { name: "SecurityEnabled", expression: "$_.SecurityEnabled" },
];

/**
 * `Get-Archive` returns a `SqlArchive` that serializes its whole `Database` inline, which
 * is where its 8,265 characters came from. The archive itself exposes only `Name`, so the
 * entry count is added — it is the one thing a caller reliably wants next, and
 * `GetEntryCount()` is a single cheap query.
 */
export const ARCHIVE_PROJECTION: ProjectedProperty[] = [
    { name: "Name", expression: "$_.Name" },
    { name: "EntryCount", expression: "$_.GetEntryCount()" },
];

/**
 * `Get-ItemAcl` emits `AccessRule`, which nests the whole `AccessRight` descriptor and the
 * `Account`'s domain — 756 characters per rule, so an item with a real ACL runs to tens of
 * thousands. The four fields below are the rule.
 */
export const ACCESS_RULE_PROJECTION: ProjectedProperty[] = [
    { name: "Account", expression: "$_.Account.Name" },
    { name: "AccountType", expression: "$_.Account.AccountType.ToString()" },
    { name: "AccessRight", expression: "$_.AccessRight.Name" },
    { name: "PermissionType", expression: "$_.PermissionType.ToString()" },
    { name: "PropagationType", expression: "$_.PropagationType.ToString()" },
    { name: "SecurityPermission", expression: "$_.SecurityPermission.ToString()" },
];

/**
 * The security cmdlets return `Sitecore.Security.Accounts.User` / `Role`, which serialize
 * their `Domain`, `Profile`, `RuntimeSettings` and `Delegation` inline: 3,385 characters to
 * read one user by name, 4,466 for the current user, 4,919 for one member of a role. The
 * identity and profile below are what a caller acts on.
 *
 * `Profile` exists on a `User` and not on a `Role`; PowerShell returns null for a missing
 * property rather than throwing, so one projection serves both and `security-get-role-member`
 * — which emits a mixed stream of users and roles — keeps working.
 */
export const ACCOUNT_PROJECTION: ProjectedProperty[] = [
    { name: "Name", expression: "$_.Name" },
    { name: "AccountType", expression: "$_.AccountType.ToString()" },
    { name: "Domain", expression: "$_.Domain.Name" },
    { name: "DisplayName", expression: "$_.DisplayName" },
    { name: "LocalName", expression: "$_.LocalName" },
    { name: "IsAdministrator", expression: "$_.IsAdministrator" },
    { name: "FullName", expression: "$_.Profile.FullName" },
    { name: "Email", expression: "$_.Profile.Email" },
    { name: "Comment", expression: "$_.Profile.Comment" },
];

/** Roles carry no profile; `IsEveryone` and `IsGlobal` are theirs alone. */
export const ROLE_PROJECTION: ProjectedProperty[] = [
    { name: "Name", expression: "$_.Name" },
    { name: "AccountType", expression: "$_.AccountType.ToString()" },
    { name: "Domain", expression: "$_.Domain.Name" },
    { name: "DisplayName", expression: "$_.DisplayName" },
    { name: "LocalName", expression: "$_.LocalName" },
    { name: "IsEveryone", expression: "$_.IsEveryone" },
    { name: "IsGlobal", expression: "$_.IsGlobal" },
];

/** `Get-Domain` returns 2,051 characters for the instance's domains, mostly `Appearance`. */
export const DOMAIN_PROJECTION: ProjectedProperty[] = [
    { name: "Name", expression: "$_.Name" },
    { name: "AccountPrefix", expression: "$_.AccountPrefix" },
    { name: "EveryoneRoleName", expression: "$_.EveryoneRoleName" },
    { name: "MemberPattern", expression: "$_.MemberPattern" },
    { name: "IsDefault", expression: "$_.IsDefault" },
    { name: "LocallyManaged", expression: "$_.LocallyManaged" },
    { name: "EnsureAnonymousUser", expression: "$_.EnsureAnonymousUser" },
];

// Both of these are spread into ~33 tools, so every character is paid 33 times on every
// turn. Kept to one line each; the reasoning lives in this file's header, not in the wire
// format.
const FIELDS_DESCRIPTION =
    "Extra Sitecore field names to include, e.g. ['Title']. Ignored when full is true.";

const FULL_DESCRIPTION =
    "Return the unprojected .NET object graph. Very large (100,000+ chars/item); diagnostics only.";

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
