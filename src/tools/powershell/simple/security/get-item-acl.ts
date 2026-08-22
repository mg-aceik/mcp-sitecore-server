import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { requireOneTarget } from "@/tools/target-input.js";
import { runGenericPowershellCommand } from "../generic.js";

export function getItemAclPowerShellTool(server: McpServer, config: Config) {
    server.registerTool(
        "security-get-item-acl",
        {
            description: "Gets the access control list (ACL) of a Sitecore item.",
            inputSchema: z.object({
                id: z.string().optional()
                    .describe("The ID of the item to get ACL for. Supply this or path."),
                path: z.string().optional()
                    .describe("The path of the item to get ACL for (e.g. /sitecore/content/Home). Supply this or id."),
                includeInherited: z.boolean().optional()
                    .describe("If set to true, includes inherited ACL entries"),
                includeSystem: z.boolean().optional()
                    .describe("If set to true, includes system ACL entries"),
                database: z.string().optional()
                    .describe("The database containing the item (defaults to the context database)")
            }),
        },
        async (params) => {
            const invalid = requireOneTarget(params, ["id", "path"]);
            if (invalid) {
                return invalid;
            }

            const command = `Get-ItemAcl`;
            const options: Record<string, any> = {
                ...(params.id ? { "ID": params.id } : { "Path": params.path }),
            };

            if (params.includeInherited) {
                options["IncludeInherited"] = "";
            }

            if (params.includeSystem) {
                options["IncludeSystem"] = "";
            }

            if (params.database) {
                options["Database"] = params.database;
            }

            return safeMcpResponse(runGenericPowershellCommand(config, command, options));
        }
    );
}
