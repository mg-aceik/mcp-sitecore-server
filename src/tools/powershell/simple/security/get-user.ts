import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { hasTarget, requireOneTarget } from "@/tools/target-input.js";
import { runGenericPowershellCommand } from "../generic.js";
import { ACCOUNT_PROJECTION, fixedProjectionPipeline, fullOnlyInputSchema } from "../../projection.js";

/**
 * `security-get-user-by-identity` and `security-get-user-by-filter` merged.
 *
 * The two differed only in which parameter they passed to the same `Get-User` cmdlet, which
 * is exactly the shape 2.0.0's `-by-id` / `-by-path` merge already collapsed everywhere
 * else: the discriminator becomes an input, and `requireOneTarget` rejects zero or two.
 */
export function getUserPowerShellTool(server: McpServer, config: Config) {
    server.registerTool(
        "security-get-user",
        {
            description:
                "Get Sitecore users, by exact identity or by wildcard filter. Supply exactly one of "
                + "identity or filter.",
            inputSchema: z.object({
                identity: z.string().optional()
                    .describe("Exact account name, e.g. 'sitecore\\admin'. Supply this or filter."),
                filter: z.string().optional()
                    .describe("Wildcard pattern, e.g. 'sitecore\\*'. Supply this or identity."),
                ...fullOnlyInputSchema,
            }),
        },
        async (params) => {
            const invalid = requireOneTarget(params, ["identity", "filter"]);
            if (invalid) {
                return invalid;
            }

            const command = `Get-User`;
            const options: Record<string, any> = hasTarget(params.identity)
                ? { "Identity": params.identity }
                : { "Filter": params.filter };

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
