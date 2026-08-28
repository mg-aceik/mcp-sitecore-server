import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { hasTarget } from "@/tools/target-input.js";
import { runGenericPowershellCommand } from "../generic.js";

export function setUserPasswordPowerShellTool(server: McpServer, config: Config) {
    server.registerTool(
        "security-set-user-password",
        {
            description:
                "Sets a new password for a Sitecore user. Supply either 'oldPassword' (validated "
                + "before the change) or 'resetPassword: true' (an administrative reset that does not "
                + "need the current password) — SPE offers no third way to change a password.",
            inputSchema: z.object({
                identity: z.string()
                    .describe("The identity of the user to update the password for (e.g. 'admin' or full path 'sitecore\\admin')"),
                newPassword: z.string()
                    .describe("The new password for the user"),
                resetPassword: z.boolean().optional()
                    .describe("Administrative reset: change the password without knowing the current one. Supply this or 'oldPassword'."),
                oldPassword: z.string().optional()
                    .describe("The user's current password, validated before the change. Supply this or 'resetPassword: true'."),
            }),
        },
        async (params) => {
            // Set-UserPassword has two parameter sets and both are gated: one requires
            // -OldPassword, the other -Reset. A call with only -NewPassword satisfies
            // neither and SPE answers "Cannot process command because of one or more
            // missing mandatory parameters: OldPassword" -- which reads as a server fault
            // rather than a call the agent can fix, and never mentions the -Reset route at
            // all. The description used to imply oldPassword was purely optional.
            if (!params.resetPassword && !hasTarget(params.oldPassword)) {
                return {
                    isError: true,
                    content: [
                        {
                            type: "text",
                            text:
                                "Supply either 'oldPassword' (the user's current password, which is "
                                + "validated) or 'resetPassword: true' (an administrative reset that does "
                                + "not need it). SPE rejects a password change that provides neither.",
                        },
                    ],
                };
            }

            const command = `Set-UserPassword`;
            const options: Record<string, any> = {
                "Identity": params.identity,
                "NewPassword": params.newPassword,
            };

            if (params.resetPassword) {
                options["Reset"] = "";
            }

            if (params.oldPassword) {
                options["OldPassword"] = params.oldPassword;
            }

            return safeMcpResponse(runGenericPowershellCommand(config, command, options));
        }
    );
}