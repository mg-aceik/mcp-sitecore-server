import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { runGenericPowershellCommand } from "../generic.js";

export function importUserPowerShellTool(server: McpServer, config: Config) {
    server.registerTool(
        "security-import-user",
        {
            description: "Imports (deserializes) a Sitecore user from the server filesystem, overwriting the user's current state with the serialized one. The .user file must exist — export it first with security-export-user. On SitecoreAI prefer Sitecore CLI serialization; this operates on the CM's own filesystem only.",
            inputSchema: z.object({
                identity: z.string()
                    .describe("The identity of the user to import (e.g. 'admin' or full path 'sitecore\\admin')"),
                root: z.string()
                    .describe("The server-side directory to deserialize from. Defaults to the Sitecore serialization folder. Do not combine with path.")
                    .optional(),
                path: z.string()
                    .describe("The exact server-side .user file to deserialize. Do not combine with root.")
                    .optional(),
            }),
        },
        async (params) => {
            const command = `Import-User`;
            const options: Record<string, any> = {
                "Identity": params.identity,
                "Root": params.root,
                "Path": params.path,
            };

            return safeMcpResponse(runGenericPowershellCommand(config, command, options));
        }
    );
}
