import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { hasTarget, requireOneTarget } from "@/tools/target-input.js";
import { runGenericPowershellCommand } from "../../simple/generic.js";
import { PowershellCommandBuilder, quotePowerShellString } from "../../command-builder.js";
import { EFFECTIVE_FINAL_LAYOUT_DESCRIPTION, getFinalLayoutSwitchValue } from "../../utils.js";
import { renderingLookupGuard, renderingNotFoundMessage } from "./rendering-guard.js";

/**
 * Three tools became one here, and they addressed two different things.
 *
 * The item is named by `id` or `path`. The rendering to replace is named by
 * `oldRenderingId`, `oldRenderingPath` or `uniqueId`, and the last of those takes a
 * different route through SPE: `Switch-Rendering -UniqueId` resolves the instance itself,
 * so that branch does not guard the lookup up front, exactly as
 * `presentation-switch-rendering-by-unique-id` did. The other two branches keep issue #62's
 * guard, because they select with `Where-Object` and would otherwise hand `Switch-Rendering`
 * an empty collection and silently do nothing.
 *
 * SPE's `Switch-Rendering` assigns the replacement a NEW uniqueId — the caller's id dies
 * with the old instance. Every branch therefore diffs the rendering list before and after
 * and returns one row per switched instance (new UniqueId, RenderingID, Placeholder,
 * Datasource), so a follow-up `presentation-set-rendering` has an id that exists. The
 * uniqueId branch also fails loudly when the diff is empty: SPE silently does nothing for
 * an unknown uniqueId, and returning nothing here used to look like success.
 */

/**
 * Emits the before/after machinery around a switch. `lookup` is the `Get-Rendering`
 * parameter string addressing the item on the targeted layout; `switchStatement` is the
 * branch-specific switching code; `emptyDiffGuard` (optional) is run when nothing changed.
 * The diff keys on UniqueId AND rendering id, so it reports the switched instances whether
 * SPE regenerates the uniqueId (observed behavior) or ever starts preserving it.
 */
function buildSwitchAndReport(lookup: string, switchStatement: string, emptyDiffGuard = ""): string {
    return `
                $beforeRenderings = @{};
                foreach ($rendering in @(Get-Rendering ${lookup})) {
                    $beforeRenderings[$rendering.UniqueId] = $rendering.ItemID;
                }
                ${switchStatement}
                $switchedRenderings = @(Get-Rendering ${lookup} | Where-Object {
                    (-not $beforeRenderings.ContainsKey($_.UniqueId)) -or ($beforeRenderings[$_.UniqueId] -ne $_.ItemID)
                });
                ${emptyDiffGuard}
                foreach ($rendering in $switchedRenderings) {
                    [PSCustomObject]@{
                        UniqueId = $rendering.UniqueId;
                        RenderingID = $rendering.ItemID;
                        Placeholder = $rendering.Placeholder;
                        Datasource = $rendering.Datasource;
                    }
                }
            `;
}

export function switchRenderingPowershellTool(server: McpServer, config: Config) {
    server.registerTool(
        "presentation-switch-rendering",
        {
            description:
                "Switches an existing rendering on an item with an alternate one. The switched "
                + "instance gets a NEW uniqueId (SPE regenerates it); the tool returns one row per "
                + "switched instance with the new UniqueId, RenderingID, Placeholder and Datasource "
                + "— use that UniqueId for any follow-up call, the old one no longer exists.",
            inputSchema: z.object({
                id: z.string().optional()
                    .describe("The ID of the item holding the renderings. Supply this or path."),
                path: z.string().optional()
                    .describe("The path of the item holding the renderings. Supply this or id."),
                uniqueId: z.string().optional()
                    .describe("The unique ID of the rendering instance to switch. Supply this, oldRenderingId or oldRenderingPath."),
                oldRenderingId: z.string().optional()
                    .describe("The ID of the rendering to switch; every instance of it on the item is switched. Supply this, oldRenderingPath or uniqueId."),
                oldRenderingPath: z.string().optional()
                    .describe("The path of the rendering to switch; every instance of it on the item is switched. Supply this, oldRenderingId or uniqueId."),
                newRenderingId: z.string().optional()
                    .describe("The ID of the new rendering. Supply this or newRenderingPath."),
                newRenderingPath: z.string().optional()
                    .describe("The path of the new rendering. Supply this or newRenderingId."),
                database: z.string()
                    .describe("The context database. Sent when addressing by ID -- a path carries its own database prefix (e.g. master:/sitecore/content/Home).")
                    .optional().default("master"),
                finalLayout: z
                    .boolean()
                    .describe(EFFECTIVE_FINAL_LAYOUT_DESCRIPTION)
                    .optional(),
                language: z.string().describe("The language version of the item holding the renderings.").optional(),
            }),
        },
        async (params) => {
            const invalidItem = requireOneTarget(params, ["id", "path"]);
            if (invalidItem) {
                return invalidItem;
            }

            const invalidOld = requireOneTarget(params, ["uniqueId", "oldRenderingId", "oldRenderingPath"]);
            if (invalidOld) {
                return invalidOld;
            }

            const invalidNew = requireOneTarget(params, ["newRenderingId", "newRenderingPath"]);
            if (invalidNew) {
                return invalidNew;
            }

            const commandBuilder = new PowershellCommandBuilder();

            const itemParameters: Record<string, any> = hasTarget(params.id)
                ? { "Id": params.id, "Database": params.database }
                : { "Path": params.path };

            const newRenderingParameters: Record<string, any> = params.newRenderingId
                ? { "Id": params.newRenderingId, "Database": params.database }
                : { "Path": params.newRenderingPath };

            const switchRenderingParameters: Record<string, any> = { ...itemParameters };
            if (params.uniqueId) {
                switchRenderingParameters["UniqueId"] = params.uniqueId;
            }
            switchRenderingParameters["Language"] = params.language;
            switchRenderingParameters["FinalLayout"] = getFinalLayoutSwitchValue(params.finalLayout);

            const newRendering =
                `$targetRendering = New-Rendering${commandBuilder.buildParametersString(newRenderingParameters)}`;

            const getRenderingParameters: Record<string, any> = { ...itemParameters };
            getRenderingParameters["Language"] = params.language;
            getRenderingParameters["FinalLayout"] = getFinalLayoutSwitchValue(params.finalLayout);
            const lookup = commandBuilder.buildParametersString(getRenderingParameters);

            // -UniqueId names the instance, so SPE does the lookup itself. SPE 8 throws
            // "Cannot find a rendering to remove" for an unknown uniqueId; the empty-diff
            // guard below is the backstop for SPE paths that no-op instead, so a switch
            // that changed nothing can never read as success.
            if (params.uniqueId) {
                const nothingSwitched =
                    `Switch-Rendering changed nothing: no rendering with unique ID '${params.uniqueId}' `
                    + `was switched on ${hasTarget(params.id)
                        ? `the item with ID '${params.id}' in database '${params.database}'`
                        : `the item at path '${params.path}'`}. `
                    + `Verify the unique ID, the language, and that you are targeting the right layout `
                    + `(shared vs final) — use presentation-list-renderings to see the renderings present.`;

                const command = buildSwitchAndReport(
                    lookup,
                    `${newRendering}
                Switch-Rendering -NewRendering $targetRendering ${commandBuilder.buildParametersString(switchRenderingParameters)}`,
                    renderingLookupGuard("$switchedRenderings", nothingSwitched, { collection: true })
                );

                return safeMcpResponse(runGenericPowershellCommand(config, command, {}));
            }

            // The ID form compares against the literal ID; the path form resolves the
            // rendering item first and compares against its ID.
            const oldRenderingLookup = params.oldRenderingId
                ? {
                    resolve: "",
                    comparand: quotePowerShellString(params.oldRenderingId),
                    described: `a rendering with ID '${params.oldRenderingId}'`,
                }
                : {
                    resolve: `$oldRendering = Get-Item -Path ${quotePowerShellString(params.oldRenderingPath)}\n                `,
                    comparand: "$oldRendering.ID.ToString()",
                    described: `a rendering matching path '${params.oldRenderingPath}'`,
                };

            const notFound = renderingNotFoundMessage(
                `${oldRenderingLookup.described} on ${hasTarget(params.id)
                    ? `the item with ID '${params.id}' in database '${params.database}'`
                    : `the item at path '${params.path}'`}`,
                "presentation-get-rendering"
            );

            const command = buildSwitchAndReport(
                lookup,
                `${oldRenderingLookup.resolve}$sourceRenderings = Get-Rendering ${lookup} | Where-Object { $_.ItemID -ceq ${oldRenderingLookup.comparand} };
                ${renderingLookupGuard("$sourceRenderings", notFound, { collection: true })}
                ${newRendering}
                foreach($sourceRendering in $sourceRenderings) {
                    Switch-Rendering -Instance $sourceRendering -NewRendering $targetRendering ${commandBuilder.buildParametersString(switchRenderingParameters)}
                }`
            );

            return safeMcpResponse(runGenericPowershellCommand(config, command, {}));
        }
    );
}
