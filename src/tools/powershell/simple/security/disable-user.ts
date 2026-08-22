import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { runGenericPowershellCommand } from "../generic.js";

export function disableUserPowerShellTool(server: McpServer, config: Config) {
    server.registerTool(
        "security-disable-user",
        {
            description: "Disables the Sitecore user account.",
            inputSchema: z.object({
                identity: z.string(),
            }),
        },
        async (params) => {
            const command = `Disable-User`;
            const options: Record<string, any>= {
                "Identity": params.identity,
            };

            return safeMcpResponse(runGenericPowershellCommand(config, command, options));
        }
    );
}