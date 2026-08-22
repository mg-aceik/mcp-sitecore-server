import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { hasTarget, requireOneTarget } from "@/tools/target-input.js";
import { runGenericPowershellCommand } from "../generic.js";
import { AccessRights } from "./access-rights.js";

export function testItemAclPowerShellTool(server: McpServer, config: Config) {
    server.registerTool(
        "security-test-item-acl",
        {
            description: "Tests whether a user or role has specific access rights to a Sitecore item.",
            inputSchema: z.object({
                id: z.string().optional()
                    .describe("The ID of the item to test access rights on. Supply this or path."),
                path: z.string().optional()
                    .describe("The path of the item to test access rights on (e.g. /sitecore/content/Home). Supply this or id."),
                identity: z.string()
                    .describe("The identity of the user or role to test (e.g. 'sitecore\\admin')"),
                accessRight: z.enum(AccessRights)
                    .describe("The access right to test (e.g. 'item:read', 'item:write')"),
                propType: z.enum(["Descendants", "Children", "Entity"]).optional()
                    .describe("The propagation type for the access right"),
                database: z.string().optional()
                    .describe("The database containing the item (defaults to the context database)")
            }),
        },
        async (params) => {
            const invalid = requireOneTarget(params, ["id", "path"]);
            if (invalid) {
                return invalid;
            }

            const command = `Test-ItemAcl`;
            const options: Record<string, any> = {
                ...(hasTarget(params.id) ? { "ID": params.id } : { "Path": params.path }),
                "Identity": params.identity,
                "AccessRight": params.accessRight,
            };

            if (params.propType) {
                options["PropType"] = params.propType;
            }

            if (params.database) {
                options["Database"] = params.database;
            }

            return safeMcpResponse(runGenericPowershellCommand(config, command, options));
        }
    );
}
