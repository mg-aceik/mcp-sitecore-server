import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { requireAtMostOneTarget } from "@/tools/target-input.js";
import { runGenericPowershellCommand } from "../generic.js";

export function exportRolePowerShellTool(server: McpServer, config: Config) {
    server.registerTool(
        "security-export-role",
        {
            description: "Exports (serializes) a Sitecore role to the filesystem on the server and returns the file path. Requires SPE 8.0 or later — earlier versions fail with a NullReferenceException (SPE issue #1369).",
            inputSchema: z.object({
                identity: z.string()
                    .describe("The identity of the role to export (e.g. 'Author' or full path 'sitecore\\Author')"),
                root: z.string()
                    .describe("The server-side directory to serialize into. Defaults to the Sitecore serialization folder. Do not combine with path.")
                    .optional(),
                path: z.string()
                    .describe("The exact server-side file to serialize to. Do not combine with root.")
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

            const command = `Export-Role`;
            const options: Record<string, any> = {
                "Identity": params.identity,
                "Root": params.root,
                "Path": params.path,
            };

            return safeMcpResponse(runGenericPowershellCommand(config, command, options));
        }
    );
}
