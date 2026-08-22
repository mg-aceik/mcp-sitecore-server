import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { requireOneTarget } from "@/tools/target-input.js";
import { runGenericPowershellCommand } from "../../simple/generic.js";
import { PowershellCommandBuilder, quotePowerShellString } from "../../command-builder.js";
import { getSwitchParameterValue } from "../../utils.js";
import { renderingLookupGuard, renderingNotFoundMessage } from "./rendering-guard.js";

/**
 * Three tools became one here, and they addressed two different things.
 *
 * The item is named by `id` or `path`. The rendering to replace is named by
 * `oldRenderingId`, `oldRenderingPath` or `uniqueId`, and the last of those takes a
 * different route through SPE: `Switch-Rendering -UniqueId` resolves the instance itself,
 * so that branch neither reads the renderings first nor guards the lookup, exactly as
 * `presentation-switch-rendering-by-unique-id` did. The other two branches keep issue #62's
 * guard, because they select with `Where-Object` and would otherwise hand `Switch-Rendering`
 * an empty collection and silently do nothing.
 */
export function switchRenderingPowershellTool(server: McpServer, config: Config) {
    server.registerTool(
        "presentation-switch-rendering",
        {
            description: "Switches an existing rendering on an item with an alternate one.",
            inputSchema: {
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
                    .describe("Specifies the layout to update the rendering. If 'true', the final layout is used, otherwise - shared layout.")
                    .optional(),
                language: z.string().describe("The language version of the item holding the renderings.").optional(),
            },
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

            const itemParameters: Record<string, any> = params.id
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
            switchRenderingParameters["FinalLayout"] = getSwitchParameterValue(params.finalLayout);

            const newRendering =
                `$targetRendering = New-Rendering${commandBuilder.buildParametersString(newRenderingParameters)}`;

            // -UniqueId names the instance, so SPE does the lookup and there is nothing to
            // select or guard against.
            if (params.uniqueId) {
                const command = `
                ${newRendering}
                Switch-Rendering -NewRendering $targetRendering ${commandBuilder.buildParametersString(switchRenderingParameters)}
            `;

                return safeMcpResponse(runGenericPowershellCommand(config, command, {}));
            }

            const getRenderingParameters: Record<string, any> = { ...itemParameters };
            getRenderingParameters["Language"] = params.language;
            getRenderingParameters["FinalLayout"] = getSwitchParameterValue(params.finalLayout);

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
                `${oldRenderingLookup.described} on ${params.id
                    ? `the item with ID '${params.id}' in database '${params.database}'`
                    : `the item at path '${params.path}'`}`,
                "presentation-get-rendering"
            );

            const command = `
                ${oldRenderingLookup.resolve}$sourceRenderings = Get-Rendering ${commandBuilder.buildParametersString(getRenderingParameters)} | Where-Object { $_.ItemID -ceq ${oldRenderingLookup.comparand} };
                ${renderingLookupGuard("$sourceRenderings", notFound, { collection: true })}
                ${newRendering}
                foreach($sourceRendering in $sourceRenderings) {
                    Switch-Rendering -Instance $sourceRendering -NewRendering $targetRendering ${commandBuilder.buildParametersString(switchRenderingParameters)}
                }
            `;

            return safeMcpResponse(runGenericPowershellCommand(config, command, {}));
        }
    );
}
