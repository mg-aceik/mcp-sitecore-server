import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { requireOneTarget } from "@/tools/target-input.js";
import { PowershellCommandBuilder, quotePowerShellString } from "../../command-builder.js";
import { getSwitchParameterValue } from "../../utils.js";
import { runGenericPowershellCommand } from "../../simple/generic.js";

export function newItemClonePowerShellTool(server: McpServer, config: Config) {
    server.registerTool(
        "common-new-item-clone",
        {
            description: "Creates a new item clone based on the item provided.",
            inputSchema: z.object({
                id: z.string().optional()
                    .describe("The ID of the item to be cloned. Supply this or path."),
                path: z.string().optional()
                    .describe("The path of the item to be cloned. Supply this or id."),
                destination: z.string()
                    .describe("The path of a parent item under which the clone should be created."),
                name: z.string()
                    .describe("The name of the item clone."),
                recurse: z.boolean().optional()
                    .describe("Adds the parameter to clone the whole branch rather than a single item."),
                database: z.string().optional()
                    .describe("The database containing the item (defaults to the context database).")
            }),
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

            addParameters["Name"] = params.name;

            if (params.recurse) {
                addParameters["Recurse"] = getSwitchParameterValue(params.recurse);
            }

            if (params.database) {
                addParameters["Database"] = params.database;
            }

            const command = `
                $destinationItem = Get-Item -Path ${quotePowerShellString(params.destination)};
                New-ItemClone ${commandBuilder.buildParametersString(addParameters)} -destination $destinationItem;
            `;

            return safeMcpResponse(runGenericPowershellCommand(config, command, {}));
        }
    );
}
