import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { runGenericPowershellCommand } from "../../simple/generic.js";
import { PowershellCommandBuilder, quotePowerShellString } from "../../command-builder.js";
import { ARCHIVE_ENTRY_PROJECTION, fixedProjectionPipeline, fullOnlyInputSchema } from "../../projection.js";

export function getArchiveItemPowerShellTool(server: McpServer, config: Config) {
    server.registerTool(
        "common-get-archive-item",
        {
            description: "Gets a list of items found in the specified archive.",
            inputSchema: {
                ...fullOnlyInputSchema,
                archive: z.string()
                    .describe("The name of the archive to use when determining which items to process."),
                database: z.string()
                    .describe("The database for which the archives should be retrieved."),
                itemId: z.string().optional()
                    .describe("The ID for the original item that should be processed."),
                identity: z.string().optional()
                    .describe("The user responsible for moving the item to the archive."),
            },
        },
        async (params) => {
            const commandBuilder = new PowershellCommandBuilder();
            const parameters: Record<string, any> = {};

            if (params.itemId) {
                parameters["ItemId"] = params.itemId;
            }

            if (params.identity) {
                parameters["Identity"] = params.identity;
            }

            // The projection is appended to the final statement rather than passed as a
            // shaping option, because this command is a multi-statement script and the
            // pipeline has to attach to the Get-ArchiveItem call, not to the script.
            const projection = fixedProjectionPipeline(ARCHIVE_ENTRY_PROJECTION, params) ?? "";

            const command = `
                $database = Get-Database -Name ${quotePowerShellString(params.database)};
                $archive = Get-Archive -Database $database -Name ${quotePowerShellString(params.archive)};
                Get-ArchiveItem ${commandBuilder.buildParametersString(parameters)} -Archive $archive${projection};
            `;

            return safeMcpResponse(runGenericPowershellCommand(config, command, {}, undefined, {
                full: params.full,
            }));
        }
    );
}
