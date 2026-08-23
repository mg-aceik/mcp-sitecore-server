import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { hasTarget, requireOneTarget } from "@/tools/target-input.js";
import { runGenericPowershellCommand } from "../generic.js";
import { AccessRights } from "./access-rights.js";

export function addItemAclPowerShellTool(server: McpServer, config: Config) {
    server.registerTool(
        "security-add-item-acl",
        {
            description: "Adds an access control entry to a Sitecore item.",
            inputSchema: z.object({
                id: z.string().optional()
                    .describe("The ID of the item to add ACL entry for. Supply this or path."),
                path: z.string().optional()
                    .describe("The path of the item to add ACL entry for (e.g. /sitecore/content/Home). Supply this or id."),
                identity: z.string()
                    .describe("The identity of the account (user or role) to grant permissions to (e.g. 'sitecore\\admin')"),
                accessRight: z.enum(AccessRights)
                    .describe("The access right to grant (e.g. 'item:read', 'item:write')"),
                propagationType: z.enum(["Descendants", "Children", "Entity"]).default("Entity")
                    .describe("The propagation type for the access right"),
                securityPermission: z.enum(["AllowAccess", "DenyAccess"]).default("AllowAccess")
                    .describe("Whether to allow or deny the specified access right"),
                database: z.string().optional()
                    .describe("The database containing the item (defaults to the context database)"),
                passThrough: z.boolean().optional()
                    .describe("If set to true, passes the processed object back to the pipeline")
            }),
        },
        async (params) => {
            const invalid = requireOneTarget(params, ["id", "path"]);
            if (invalid) {
                return invalid;
            }

            const command = `Add-ItemAcl`;
            const options: Record<string, any> = {
                ...(hasTarget(params.id) ? { "ID": params.id } : { "Path": params.path }),
                "Identity": params.identity,
                "AccessRight": params.accessRight,
                "PropagationType": params.propagationType,
                "SecurityPermission": params.securityPermission
            };

            if (params.database) {
                options["Database"] = params.database;
            }

            if (params.passThrough) {
                options["PassThru"] = "";
            }

            return safeMcpResponse(runGenericPowershellCommand(config, command, options));
        }
    );
}
