import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { requireAtMostOneTarget } from "@/tools/target-input.js";
import { runGenericPowershellCommand } from "../generic.js";

export function importRolePowerShellTool(server: McpServer, config: Config) {
    server.registerTool(
        "security-import-role",
        {
            description: "Imports (deserializes) a Sitecore role from the server filesystem, overwriting the role's current state with the serialized one. The .role file must exist — export it first with security-export-role. On SitecoreAI prefer Sitecore CLI serialization; this operates on the CM's own filesystem only.",
            // Import overwrites the live role with the serialized state, which is not
            // reversible from the server's side.
            annotations: {
                title: "Import Role",
                readOnlyHint: false,
                destructiveHint: true,
            },
            inputSchema: z.object({
                identity: z.string()
                    .describe("The identity of the role to import (e.g. 'Author' or full path 'sitecore\\Author')"),
                root: z.string()
                    .describe("The server-side directory to deserialize from. Defaults to the Sitecore serialization folder. Do not combine with path.")
                    .optional(),
                path: z.string()
                    .describe("The exact server-side .role file to deserialize. Do not combine with root.")
                    .optional(),
            }),
        },
        async (params) => {
            // 'root' and 'path' name two different locations, and the docs have always said
            // not to combine them. Enforcing it here beats letting the cmdlet resolve its
            // parameter sets in an order the caller cannot see.
            const ambiguous = requireAtMostOneTarget(params, ["root", "path"]);
            if (ambiguous) {
                return ambiguous;
            }

            const command = `Import-Role`;
            const options: Record<string, any> = {
                "Identity": params.identity,
                "Root": params.root,
                "Path": params.path,
            };

            return safeMcpResponse(runGenericPowershellCommand(config, command, options));
        }
    );
}
