import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { runGenericPowershellCommand } from "../generic.js";
import { ACCOUNT_PROJECTION, fixedProjectionPipeline, fullOnlyInputSchema } from "../../projection.js";

export function getCurrentUserPowerShellTool(server: McpServer, config: Config) {
    server.registerTool(
        "security-get-current-user",
        {
            description: "Get the current Sitecore user.",
            inputSchema: z.object({ ...fullOnlyInputSchema }),
        },
        async (params) => {
            const command = `Get-User`;
            const options: Record<string, any>= {
                "Current": "",
            };
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
