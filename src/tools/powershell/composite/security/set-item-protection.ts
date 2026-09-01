import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { hasTarget, requireOneTarget } from "@/tools/target-input.js";
import { runGenericPowershellCommand } from "../../simple/generic.js";
import { itemProjectionPipeline, itemProjectionInputSchema } from "../../projection.js";
import { ITEM_DATABASE_DESCRIPTION } from "../../utils.js";

/**
 * `security-protect-item` and `security-unprotect-item` merged into one tool with an
 * `action`. Kept separate from `security-set-item-lock` — see that file for why.
 */
export function setItemProtectionPowerShellTool(server: McpServer, config: Config) {
    server.registerTool(
        "security-set-item-protection",
        {
            description:
                "Protects or unprotects a Sitecore item against deletion and renaming. Independent "
                + "of the editing lock — use security-set-item-lock for that.",
            // destructiveHint because unprotecting removes the guard that stops the item being
            // deleted; a name-inferred annotation cannot see which action was asked for.
            annotations: {
                readOnlyHint: false,
                destructiveHint: true,
            },
            inputSchema: z.object({
                action: z.enum(["protect", "unprotect"])
                    .describe("Whether to protect the item or remove its protection."),
                id: z.string().optional()
                    .describe("The ID of the item. Supply this or path."),
                path: z.string().optional()
                    .describe("The path of the item (e.g. /sitecore/content/Home). Supply this or id."),
                passThru: z.boolean().optional()
                    .describe("Return the item, projected to its identity."),
                database: z.string().optional().describe(ITEM_DATABASE_DESCRIPTION),
                ...itemProjectionInputSchema,
            }),
        },
        async (params) => {
            const invalid = requireOneTarget(params, ["id", "path"]);
            if (invalid) {
                return invalid;
            }

            const command = params.action === "protect" ? `Protect-Item` : `Unprotect-Item`;
            const options: Record<string, any> = {
                ...(hasTarget(params.id) ? { "Id": params.id } : { "Path": params.path }),
            };

            if (params.passThru) {
                options["PassThru"] = "";
            }

            if (params.database) {
                options["Database"] = params.database;
            }

            const pipeline = params.passThru ? itemProjectionPipeline(params) : undefined;

            return safeMcpResponse(
                runGenericPowershellCommand(config, command, options, undefined, {
                    pipeline,
                    full: params.full,
                })
            );
        }
    );
}
