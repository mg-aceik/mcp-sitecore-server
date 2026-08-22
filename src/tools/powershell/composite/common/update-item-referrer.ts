import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { requireOneTarget } from "@/tools/target-input.js";
import { runGenericPowershellCommand } from "../../simple/generic.js";
import { PowershellCommandBuilder, quotePowerShellString } from "../../command-builder.js";

export function updateItemReferrerPowerShellTool(server: McpServer, config: Config) {
    server.registerTool(
        "common-update-item-referrer",
        {
            description: "Updates all references to the specified item to point to a new provided in the -NewTarget or removes links to the item.",
            inputSchema: {
                id: z.string().optional()
                    .describe("The ID of the item to be relinked. Supply this or path."),
                path: z.string().optional()
                    .describe("The path of the item to be relinked. Supply this or id."),
                newTarget: z.string().optional()
                    .describe("The path to a new item the links should be pointing to."),
                removeLink: z.boolean().optional()
                    .describe("Removes all links to the current target item."),
                database: z.string().optional()
                    .describe("The database containing the item (defaults to the context database)"),
                language: z.string().optional()
                    .describe("The language of the item."),
            },
        },
        async (params) => {
            const invalid = requireOneTarget(params, ["id", "path"]);
            if (invalid) {
                return invalid;
            }

            const commandBuilder = new PowershellCommandBuilder();
            const addParameters: Record<string, any> = {};

            if (params.id) {
                addParameters["Id"] = params.id;
            } else {
                addParameters["Path"] = params.path;
            }

            if (params.language) {
                addParameters["Language"] = params.language;
            }

            if (params.database) {
                addParameters["Database"] = params.database;
            }

            if (params.removeLink) {
                const command = `
                    Update-ItemReferrer ${commandBuilder.buildParametersString(addParameters)} -RemoveLink;
                `;

                return safeMcpResponse(runGenericPowershellCommand(config, command, {}));
            }

            const command = `
                $newTargetItem = Get-Item -Path ${quotePowerShellString(params.newTarget)};
                Update-ItemReferrer ${commandBuilder.buildParametersString(addParameters)} -NewTarget $newTargetItem;
            `;

            return safeMcpResponse(runGenericPowershellCommand(config, command, {}));
        }
    );
}
