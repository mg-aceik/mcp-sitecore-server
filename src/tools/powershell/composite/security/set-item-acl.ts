import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { hasTarget, requireOneTarget } from "@/tools/target-input.js";
import { prepareArgsString } from "../../utils.js";
import { AccessRights } from "../../simple/security/access-rights.js";
import { runGenericPowershellCommand } from "../../simple/generic.js";
import { PowershellCommandBuilder, quotePowerShellString } from "../../command-builder.js";
import { itemProjectionInputSchema, itemProjectionPipeline } from "../../projection.js";
import { ITEM_DATABASE_DESCRIPTION } from "../../utils.js";

/**
 * `security-add-item-acl`, `security-set-item-acl` and `security-clear-item-acl` merged into
 * one tool with an `action`.
 *
 * The three were the same question — "what should this item's access rules be?" — split
 * across three tools, and the split actively misled: `add` and `set` differ in whether the
 * existing rules survive, which is the single most important thing about the call and was
 * discoverable only by reading two descriptions side by side. As one tool with
 * `add` / `replace` / `clear`, the choice is in front of the caller at the point of decision.
 *
 * Three different cmdlets underneath, so this dispatches:
 *
 * - `add` → `Add-ItemAcl` appends one rule, leaving the rest in place.
 * - `replace` → `New-ItemAcl` piped into `Set-ItemAcl -AccessRules`, which discards every
 *   existing rule on the item.
 * - `clear` → `Clear-ItemAcl` removes all of them and adds nothing.
 *
 * `identity` and `accessRight` describe a rule, so they are required for `add` and `replace`
 * and rejected for `clear` rather than silently ignored — a `clear` call that also named an
 * identity was most likely meant to be a `replace`.
 */

/**
 * SPE's own values, verified live rather than taken from the schema these tools shipped with.
 *
 * `propagationType` used to offer `Children`, which does not exist:
 * `Sitecore.Security.AccessControl.PropagationType` is `Unknown | Descendants | Entity | Any`,
 * and passing `Children` fails with "Unable to match the identifier name Children to a valid
 * enumerator name". Any caller who reached for it — the obvious choice for "just the immediate
 * children" — got a hard failure. `Descendants` is the whole subtree; there is no
 * children-only propagation in Sitecore.
 *
 * `securityPermission` used to offer only `AllowAccess | DenyAccess`, hiding the two
 * inheritance values Sitecore's own rules use: reading the ACL of `/sitecore/content` on a
 * live CM returns `AllowInheritance` rules that these tools could not have written.
 */
const PROPAGATION_TYPES = ["Entity", "Descendants", "Any", "Unknown"] as const;

const SECURITY_PERMISSIONS = [
    "AllowAccess",
    "DenyAccess",
    "AllowInheritance",
    "DenyInheritance",
    "NotSet",
] as const;

export function setItemAclPowerShellTool(server: McpServer, config: Config) {
    server.registerTool(
        "security-set-item-acl",
        {
            description:
                "Changes the access rules on a Sitecore item. action 'add' appends one rule and "
                + "leaves the others; 'replace' discards every existing rule on the item and leaves "
                + "only this one; 'clear' removes all rules and adds nothing. Read the current rules "
                + "with security-get-item-acl and check effective rights with security-test-item-acl.",
            annotations: {
                readOnlyHint: false,
                // 'replace' and 'clear' discard rules that are not recoverable from here.
                destructiveHint: true,
            },
            inputSchema: z.object({
                action: z.enum(["add", "replace", "clear"])
                    .describe("add appends a rule; replace discards all existing rules and leaves only this one; clear removes all rules."),
                id: z.string().optional()
                    .describe("The ID of the item. Supply this or path."),
                path: z.string().optional()
                    .describe("The path of the item (e.g. /sitecore/content/Home). Supply this or id."),
                identity: z.string().optional()
                    .describe("The account the rule applies to, e.g. 'sitecore\\Author'. Required for add and replace; not allowed for clear."),
                accessRight: z.enum(AccessRights).optional()
                    .describe("The access right the rule covers, e.g. 'item:read'. Required for add and replace; not allowed for clear."),
                propagationType: z.enum(PROPAGATION_TYPES).optional().default("Entity")
                    .describe("How far the rule propagates: Entity is this item only, Descendants the whole subtree. Sitecore has no children-only propagation."),
                securityPermission: z.enum(SECURITY_PERMISSIONS).optional().default("AllowAccess")
                    .describe("Whether the rule allows or denies the right, or allows/denies inheritance of it."),
                database: z.string().optional().default("master")
                    .describe(ITEM_DATABASE_DESCRIPTION),
                passThru: z.boolean().optional()
                    .describe("Return the processed item, projected to its identity."),
                ...itemProjectionInputSchema,
            }),
        },
        async (params) => {
            const invalid = requireOneTarget(params, ["id", "path"]);
            if (invalid) {
                return invalid;
            }

            const describesRule = hasTarget(params.identity) || params.accessRight !== undefined;

            if (params.action === "clear" && describesRule) {
                return {
                    isError: true,
                    content: [{
                        type: "text",
                        text:
                            "action 'clear' removes every rule on the item and cannot take an "
                            + "'identity' or 'accessRight'. Use action 'replace' to discard the "
                            + "existing rules and leave one of your own, or drop those inputs to clear.",
                    }],
                };
            }

            if (params.action !== "clear" && !(hasTarget(params.identity) && params.accessRight)) {
                return {
                    isError: true,
                    content: [{
                        type: "text",
                        text:
                            `action '${params.action}' writes a rule, so it needs both 'identity' `
                            + "and 'accessRight'. Supply them, or use action 'clear' to remove every "
                            + "rule instead.",
                    }],
                };
            }

            // `-Database` lives in the `-Id` parameter set only. Sending it alongside
            // `-Path` leaves the parameter set unresolvable and SPE fails the call with
            // "Parameter set cannot be resolved using the specified named parameters" --
            // which is what a `database` default did here until it was scoped to the id form.
            const addressing: Record<string, any> = hasTarget(params.id)
                ? { "ID": params.id, ...(params.database ? { "Database": params.database } : {}) }
                : { "Path": params.path };

            if (params.action === "clear") {
                const options: Record<string, any> = { ...addressing };
                if (params.passThru) {
                    options["PassThru"] = "";
                }
                return safeMcpResponse(
                    runGenericPowershellCommand(config, `Clear-ItemAcl`, options, undefined, {
                        pipeline: params.passThru ? itemProjectionPipeline(params) : undefined,
                        full: params.full,
                    })
                );
            }

            if (params.action === "add") {
                const options: Record<string, any> = {
                    ...addressing,
                    "Identity": params.identity,
                    "AccessRight": params.accessRight,
                    "PropagationType": params.propagationType,
                    "SecurityPermission": params.securityPermission,
                };
                if (params.passThru) {
                    options["PassThru"] = "";
                }
                // PassThru returns a Sitecore Item, which measured 68,686 characters
                // unprojected on a live content page.
                return safeMcpResponse(
                    runGenericPowershellCommand(config, `Add-ItemAcl`, options, undefined, {
                        pipeline: params.passThru ? itemProjectionPipeline(params) : undefined,
                        full: params.full,
                    })
                );
            }

            // replace: build the rule, then hand the item's whole rule set over to it.
            const ruleArgs = prepareArgsString({
                Identity: params.identity,
                AccessRight: params.accessRight,
                PropagationType: params.propagationType,
                SecurityPermission: params.securityPermission,
            });

            // The ID form resolves against the database root, as `-Id` requires; the path
            // form addresses the item directly.
            const itemLookup = hasTarget(params.id)
                ? `Get-Item -Id ${quotePowerShellString(params.id)} -Path ${quotePowerShellString(`${params.database}:`)}`
                : `Get-Item -Path ${quotePowerShellString(params.path)}`;

            const setArgs = new PowershellCommandBuilder().buildParametersString(
                params.passThru ? { PassThru: "" } : {}
            );

            // The projection is appended inside the script rather than passed as a shaping
            // option, because this branch is a multi-statement script and the pipeline has
            // to attach to the item Set-ItemAcl emits, not to the script.
            const projection = params.passThru ? (itemProjectionPipeline(params) ?? "") : "";

            const command = `
                $acl = New-ItemAcl ${ruleArgs};
                ${itemLookup} | Set-ItemAcl -AccessRules $acl${setArgs}${projection}
            `.replaceAll(/[\n]+/g, "");

            return safeMcpResponse(
                runGenericPowershellCommand(config, command, {}, undefined, { full: params.full })
            );
        }
    );
}
