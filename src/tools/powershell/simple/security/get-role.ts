import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { hasTarget, requireOneTarget } from "@/tools/target-input.js";
import { runGenericPowershellCommand } from "../generic.js";
import { ROLE_PROJECTION, fixedProjectionPipeline, fullOnlyInputSchema } from "../../projection.js";

/** `security-get-role-by-identity` and `security-get-role-by-filter` merged — see get-user.ts. */
export function getRolePowerShellTool(server: McpServer, config: Config) {
    server.registerTool(
        "security-get-role",
        {
            description:
                "Get Sitecore roles, by exact identity or by wildcard filter. Supply exactly one of "
                + "identity or filter.",
            inputSchema: z.object({
                identity: z.string().optional()
                    .describe("Exact role name, e.g. 'sitecore\\Author'. Supply this or filter."),
                filter: z.string().optional()
                    .describe("Wildcard pattern, e.g. 'sitecore\\*' or '*Author*'. Supply this or identity."),
                ...fullOnlyInputSchema,
            }),
        },
        async (params) => {
            const invalid = requireOneTarget(params, ["identity", "filter"]);
            if (invalid) {
                return invalid;
            }

            const command = `Get-Role`;
            const options: Record<string, any> = hasTarget(params.identity)
                ? { "Identity": params.identity }
                : { "Filter": params.filter };

            const pipeline = fixedProjectionPipeline(ROLE_PROJECTION, params);

            return safeMcpResponse(
                runGenericPowershellCommand(config, command, options, undefined, {
                    pipeline,
                    full: params.full,
                })
            );
        }
    );
}
