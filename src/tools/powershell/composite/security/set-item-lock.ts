import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { hasTarget, requireOneTarget } from "@/tools/target-input.js";
import { runGenericPowershellCommand } from "../../simple/generic.js";
import { itemProjectionPipeline, itemProjectionInputSchema } from "../../projection.js";
import { ITEM_DATABASE_DESCRIPTION } from "../../utils.js";

/**
 * `security-lock-item` and `security-unlock-item` merged into one tool with an `action`.
 *
 * Deliberately *not* merged with `security-set-item-protection`. An editing lock and delete
 * protection are independent flags — an item can be locked, protected, both or neither — so
 * folding all four verbs into a single `state` enum would tell the caller they are
 * alternatives, which is false, and would make "protect this locked item" unexpressible
 * without a second call that silently clears the first.
 *
 * `force` exists only on the lock side: SPE's `Lock-Item` takes `-Force`, `Unlock-Item` does
 * not, and passing it there failed the whole call. It is rejected up front rather than
 * silently dropped.
 */
export function setItemLockPowerShellTool(server: McpServer, config: Config) {
    server.registerTool(
        "security-set-item-lock",
        {
            description:
                "Locks or unlocks a Sitecore item for editing. Independent of delete protection — "
                + "use security-set-item-protection for that.",
            // destructiveHint because unlocking discards another user's editing lock; the
            // action is a write either way, so the annotation cannot be inferred from a name.
            annotations: {
                readOnlyHint: false,
                destructiveHint: true,
            },
            inputSchema: z.object({
                action: z.enum(["lock", "unlock"])
                    .describe("Whether to lock the item or release its lock."),
                id: z.string().optional()
                    .describe("The ID of the item. Supply this or path."),
                path: z.string().optional()
                    .describe("The path of the item (e.g. /sitecore/content/Home). Supply this or id."),
                force: z.boolean().optional()
                    .describe("action 'lock' only: take the lock even if another user holds it."),
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

            if (params.force && params.action === "unlock") {
                return {
                    isError: true,
                    content: [{
                        type: "text",
                        text:
                            "'force' applies only to action 'lock'. SPE's Unlock-Item has no -Force "
                            + "parameter and unlocks regardless of owner, so drop 'force' to unlock.",
                    }],
                };
            }

            const command = params.action === "lock" ? `Lock-Item` : `Unlock-Item`;
            const options: Record<string, any> = {
                ...(hasTarget(params.id) ? { "Id": params.id } : { "Path": params.path }),
            };

            if (params.force && params.action === "lock") {
                options["Force"] = "";
            }

            if (params.passThru) {
                options["PassThru"] = "";
            }

            if (params.database) {
                options["Database"] = params.database;
            }

            // PassThru returns a Sitecore Item, over 50,000 characters unprojected.
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
