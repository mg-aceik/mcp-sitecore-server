import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { hasTarget, requireOneTarget } from "@/tools/target-input.js";
import { runGenericPowershellCommand } from "../generic.js";
import { ACCESS_RULE_PROJECTION, fixedProjectionPipeline, fullOnlyInputSchema } from "../../projection.js";
import { ITEM_DATABASE_DESCRIPTION } from "../../utils.js";

export function getItemAclPowerShellTool(server: McpServer, config: Config) {
    server.registerTool(
        "security-get-item-acl",
        {
            description:
                "Gets the access control list (ACL) of a Sitecore item — the rules set on the item "
                + "itself. Narrow it with identity or filter to one account.",
            inputSchema: z.object({
                id: z.string().optional()
                    .describe("The ID of the item to get ACL for. Supply this or path."),
                path: z.string().optional()
                    .describe("The path of the item to get ACL for (e.g. /sitecore/content/Home). Supply this or id."),
                identity: z.string().optional()
                    .describe("Return only the rules for this exact account (e.g. 'sitecore\\Author')."),
                filter: z.string().optional()
                    .describe("Return only the rules for accounts matching this wildcard pattern (e.g. 'sitecore\\*')."),
                database: z.string().optional()
                    .describe(ITEM_DATABASE_DESCRIPTION),
                ...fullOnlyInputSchema,
            }),
        },
        async (params) => {
            const invalid = requireOneTarget(params, ["id", "path"]);
            if (invalid) {
                return invalid;
            }

            const command = `Get-ItemAcl`;
            const options: Record<string, any> = {
                ...(hasTarget(params.id) ? { "ID": params.id } : { "Path": params.path }),
            };

            // `includeInherited` and `includeSystem` used to be offered here. Neither is a
            // parameter of SPE's Get-ItemAcl, so setting either failed the whole call with
            // "A parameter cannot be found that matches parameter name 'IncludeInherited'".
            // The cmdlet's real filters are -Identity and -Filter, which is what the two
            // parameters below expose. Inherited rules are read from the ancestor items;
            // security-test-item-acl answers the effective-rights question directly.
            if (params.identity) {
                options["Identity"] = params.identity;
            }

            if (params.filter) {
                options["Filter"] = params.filter;
            }

            if (params.database) {
                options["Database"] = params.database;
            }

            const pipeline = fixedProjectionPipeline(ACCESS_RULE_PROJECTION, params);

            return safeMcpResponse(
                runGenericPowershellCommand(config, command, options, undefined, {
                    pipeline,
                    full: params.full,
                })
            );
        }
    );
}
