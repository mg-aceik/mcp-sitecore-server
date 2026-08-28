import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { requireAtMostOneTarget } from "@/tools/target-input.js";
import { runGenericPowershellCommand } from "../generic.js";

/**
 * The four export/import tools collapsed along the axis that carried no behaviour.
 *
 * `security-export-user` / `-export-role` and `security-import-user` / `-import-role`
 * differed only in the cmdlet noun, so the account type becomes an input. Direction stays a
 * separate tool rather than a third enum value: export writes a file and is otherwise
 * harmless, while import overwrites the live account with whatever the file holds. One tool
 * covering both would have to declare `destructiveHint: true` for the export case too, and a
 * safety annotation that is wrong half the time is worse than two tools.
 */
const ACCOUNT_TYPE_DESCRIPTION = "Whether the identity names a user or a role.";

const ROOT_DESCRIPTION =
    "Server-side directory to serialize into. Defaults to Sitecore's serialization folder. Not with path.";

const PATH_DESCRIPTION = "Exact server-side file to serialize to. Not with root.";

export function exportAccountPowerShellTool(server: McpServer, config: Config) {
    server.registerTool(
        "security-export-account",
        {
            description:
                "Exports (serializes) a Sitecore user or role to the CM's own filesystem and returns "
                + "the file path. Requires SPE 8.0 or later — earlier versions fail with a "
                + "NullReferenceException (SPE issues #1369, #1370). On SitecoreAI prefer Sitecore "
                + "CLI serialization.",
            inputSchema: z.object({
                accountType: z.enum(["user", "role"]).describe(ACCOUNT_TYPE_DESCRIPTION),
                identity: z.string()
                    .describe("The account to export, e.g. 'sitecore\\admin' or 'sitecore\\Author'."),
                root: z.string().optional().describe(ROOT_DESCRIPTION),
                path: z.string().optional().describe(PATH_DESCRIPTION),
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

            const command = params.accountType === "user" ? `Export-User` : `Export-Role`;
            const options: Record<string, any> = {
                "Identity": params.identity,
                "Root": params.root,
                "Path": params.path,
            };

            return safeMcpResponse(runGenericPowershellCommand(config, command, options));
        }
    );
}

export function importAccountPowerShellTool(server: McpServer, config: Config) {
    server.registerTool(
        "security-import-account",
        {
            description:
                "Imports (deserializes) a Sitecore user or role from the CM's filesystem, "
                + "overwriting the account's current state with the serialized one. The .user / "
                + ".role file must exist — export it first with security-export-account. On "
                + "SitecoreAI prefer Sitecore CLI serialization.",
            // Import overwrites the live account with the serialized state, which is not
            // reversible from the server's side.
            annotations: {
                readOnlyHint: false,
                destructiveHint: true,
            },
            inputSchema: z.object({
                accountType: z.enum(["user", "role"]).describe(ACCOUNT_TYPE_DESCRIPTION),
                identity: z.string()
                    .describe("The account to import, e.g. 'sitecore\\admin' or 'sitecore\\Author'."),
                root: z.string().optional()
                    .describe("Server-side directory to deserialize from. Defaults to Sitecore's serialization folder. Not with path."),
                path: z.string().optional()
                    .describe("Exact server-side .user / .role file to deserialize. Not with root."),
            }),
        },
        async (params) => {
            const ambiguous = requireAtMostOneTarget(params, ["root", "path"]);
            if (ambiguous) {
                return ambiguous;
            }

            const command = params.accountType === "user" ? `Import-User` : `Import-Role`;
            const options: Record<string, any> = {
                "Identity": params.identity,
                "Root": params.root,
                "Path": params.path,
            };

            return safeMcpResponse(runGenericPowershellCommand(config, command, options));
        }
    );
}
