import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { hasTarget, requireAtMostOneTarget } from "@/tools/target-input.js";
import { runGenericPowershellCommand } from "../generic.js";
import { quotePowerShellString } from "../../command-builder.js";
import { ITEM_DATABASE_DESCRIPTION } from "../../utils.js";

/**
 * `indexing-initialize-search-index` and `indexing-initialize-search-index-item` merged into
 * `indexing-rebuild-search-index`, with the item optional.
 *
 * The two were one question — "rebuild what?" — split across two tools whose names differed
 * by a suffix, and the narrower one was the harder to find precisely because
 * `-search-index-item` reads like a variant of the other rather than the scoped form of it.
 * Supplying `id` or `path` now scopes the rebuild to that subtree; omitting both rebuilds the
 * whole index.
 *
 * They are two different SPE cmdlets under the covers, which is why this dispatches rather
 * than passing a flag through:
 *
 * - `Initialize-SearchIndex [-Name <String>] [-IncludeRemoteIndex] [-AsJob]`
 * - `Initialize-SearchIndexItem -Item <Item> [-Name <String>] [-AsJob]`
 *
 * `-AsJob` is on both, so `asJob` works either way. `-IncludeRemoteIndex` is on the
 * whole-index cmdlet only, so it is refused with an item rather than silently dropped.
 *
 * "Rebuild" is also the verb SPE itself uses: `Rebuild-SearchIndexItem` is the documented
 * alias for the item cmdlet, so the tool name now matches the vocabulary of the platform.
 */

/**
 * The index-name default differs by mode, so it cannot be a zod `.default()`.
 *
 * `Initialize-SearchIndex` treats a missing `-Name` as every index, which is the useful
 * whole-index default. `Initialize-SearchIndexItem` needs a name and the old item tool
 * defaulted it to a wildcard covering the standard set. Declaring either as the schema
 * default would silently change the other mode's meaning, so the fallback is applied per
 * branch below.
 */
const ITEM_MODE_INDEX_DEFAULT = "sitecore_*_index";

export function rebuildSearchIndexPowerShellTool(server: McpServer, config: Config) {
    server.registerTool(
        "indexing-rebuild-search-index",
        {
            description:
                "Rebuilds Sitecore search indexes. Omit id and path to rebuild whole indexes — and "
                + "omit name too to rebuild every index, which is expensive and leaves search results "
                + "incomplete while it runs. Supply id or path to rebuild only that item's subtree, "
                + "which is what you want after changing a branch of content. Pass asJob to queue it "
                + "and poll with common-get-sitecore-job rather than waiting.",
            annotations: {
                readOnlyHint: false,
                destructiveHint: false,
            },
            inputSchema: z.object({
                name: z.string().optional()
                    .describe(
                        "The index to rebuild; supports wildcards. Omit to rebuild every index when "
                        + `rebuilding whole indexes, or to use '${ITEM_MODE_INDEX_DEFAULT}' when `
                        + "rebuilding one item's subtree."
                    ),
                id: z.string().optional()
                    .describe("Rebuild only this item's subtree. Supply this or path, or neither for whole indexes."),
                path: z.string().optional()
                    .describe("Rebuild only this item's subtree, e.g. /sitecore/content/Home. Supply this or id, or neither for whole indexes."),
                database: z.string().optional().default("master")
                    .describe(ITEM_DATABASE_DESCRIPTION),
                includeRemoteIndex: z.boolean().optional()
                    .describe("Whole-index rebuilds only: include remote indexes."),
                asJob: z.boolean().optional()
                    .describe("Queue the rebuild as a Sitecore job instead of running it inline."),
            }),
        },
        async (params) => {
            // Neither is valid here -- that is the whole-index mode -- but naming two items is
            // the same ambiguity requireOneTarget rejects everywhere else.
            const ambiguous = requireAtMostOneTarget(params, ["id", "path"]);
            if (ambiguous) {
                return ambiguous;
            }

            const scoped = hasTarget(params.id) || hasTarget(params.path);

            if (scoped && params.includeRemoteIndex) {
                return {
                    isError: true,
                    content: [{
                        type: "text",
                        text:
                            "'includeRemoteIndex' applies only to a whole-index rebuild. SPE's "
                            + "Initialize-SearchIndexItem, which rebuilds one item's subtree, has no "
                            + "such parameter. Drop 'includeRemoteIndex', or drop 'id'/'path' to "
                            + "rebuild the whole index.",
                    }],
                };
            }

            if (!scoped) {
                const command = `Initialize-SearchIndex`;
                const options: Record<string, any> = {};

                if (params.name) {
                    options["Name"] = params.name;
                }
                if (params.includeRemoteIndex) {
                    options["IncludeRemoteIndex"] = "";
                }
                if (params.asJob) {
                    options["AsJob"] = "";
                }

                return safeMcpResponse(runGenericPowershellCommand(config, command, options));
            }

            // `-Id` needs a database root to resolve against; a path is already qualified.
            const itemLookup = hasTarget(params.id)
                ? `Get-Item -Id ${quotePowerShellString(params.id)} -Path ${quotePowerShellString(`${params.database}:`)}`
                : `Get-Item -Path ${quotePowerShellString(params.path)}`;

            const indexName = params.name ?? ITEM_MODE_INDEX_DEFAULT;
            const asJob = params.asJob ? " -AsJob" : "";

            const command = `
                $item = ${itemLookup};
                $indexName = ${quotePowerShellString(indexName)};
                Initialize-SearchIndexItem -Item $item -Name $indexName${asJob}
            `.replaceAll(/[\n]+/g, "");

            return safeMcpResponse(runGenericPowershellCommand(config, command, {}));
        }
    );
}
