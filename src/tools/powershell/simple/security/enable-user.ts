import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { runGenericPowershellCommand } from "../generic.js";

export function enableUserPowerShellTool(server: McpServer, config: Config) {
    server.registerTool(
        "security-enable-user",
        {
            description: "Enables the Sitecore user account.",
            inputSchema: z.object({
                identity: z.string(),
            }),
        },
        async (params) => {
            const command = `Enable-User`;
            const options: Record<string, any>= {
                "Identity": params.identity,
            };

            return safeMcpResponse(runGenericPowershellCommand(config, command, options));
        }
    );
}