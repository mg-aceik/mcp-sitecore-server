import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { runGenericPowershellCommand } from "../generic.js";
import { DOMAIN_PROJECTION, fixedProjectionPipeline, fullOnlyInputSchema } from "../../projection.js";

/**
 * `security-get-domain` and `security-get-domain-by-name` merged.
 *
 * `Get-Domain` already treats a missing `-Name` as "every domain", so the two tools were one
 * cmdlet call differing by whether one optional parameter was set — nothing a caller needed
 * two tool schemas to express.
 */
export function getAllDomainsPowerShellTool(server: McpServer, config: Config) {
    server.registerTool(
        "security-get-domain",
        {
            description: "Get Sitecore domains. Omit name to return every domain.",
            inputSchema: z.object({
                name: z.string().optional()
                    .describe("The domain to return, e.g. 'sitecore'. Omit for all domains."),
                ...fullOnlyInputSchema,
            }),
        },
        async (params) => {
            const command = `Get-Domain`;
            const options: Record<string, any> = {};

            if (params.name) {
                options["Name"] = params.name;
            }

            const pipeline = fixedProjectionPipeline(DOMAIN_PROJECTION, params);

            return safeMcpResponse(
                runGenericPowershellCommand(config, command, options, undefined, {
                    pipeline,
                    full: params.full,
                })
            );
        }
    );
}
