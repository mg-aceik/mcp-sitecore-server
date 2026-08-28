import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { runGenericPowershellCommand } from "../generic.js";
import { ROLE_PROJECTION, fixedProjectionPipeline, fullOnlyInputSchema } from "../../projection.js";

export function newRolePowerShellTool(server: McpServer, config: Config) {
    server.registerTool(
        "security-new-role",
        {
            description: "Creates a new Sitecore role.",
            inputSchema: z.object({
                ...fullOnlyInputSchema,
            identity: z.string()
                .describe("The identity of the role to create (e.g. 'CustomRole' or full path 'sitecore\\CustomRole')"),
            }),
        },
        async (params) => {
            const command = `New-Role`;
            const options: Record<string, any> = {
                "Identity": params.identity,
            };

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