import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { runGenericPowershellCommand } from "../generic.js";
import { ACCOUNT_PROJECTION, fixedProjectionPipeline, fullOnlyInputSchema } from "../../projection.js";

export function getRoleMemberPowerShellTool(server: McpServer, config: Config) {
    server.registerTool(
        "security-get-role-member",
        {
            description: "Get members of a Sitecore role.",
            inputSchema: z.object({
                ...fullOnlyInputSchema,
                identity: z.string()
                    .describe("The identity of the role to get members from (e.g. 'sitecore\\Author')"),
                recurse: z.boolean().optional()
                    .describe("If set to true, gets all members recursively (including members of nested roles)"),
                userOnly: z.boolean().optional()
                    .describe("If set to true, only gets user members (excluding roles)"),
                roleOnly: z.boolean().optional()
                    .describe("If set to true, only gets role members (excluding users)"),
            }),
        },
        async (params) => {
            const command = `Get-RoleMember`;
            const options: Record<string, any> = {
                "Identity": params.identity,
            };

            if (params.recurse) {
                options["Recurse"] = "";
            }

            // SPE names these `-UsersOnly` and `-RolesOnly`, plural. Sending the singular
            // form failed the whole call with "A parameter cannot be found that matches
            // parameter name 'UserOnly'", so both of these switches were unreachable.
            if (params.userOnly) {
                options["UsersOnly"] = "";
            }

            if (params.roleOnly) {
                options["RolesOnly"] = "";
            }

            const pipeline = fixedProjectionPipeline(ACCOUNT_PROJECTION, params);

            return safeMcpResponse(
                runGenericPowershellCommand(config, command, options, undefined, {
                    pipeline,
                    full: params.full,
                })
            );
        }
    );
}