import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { runGenericPowershellCommand } from "../../simple/generic.js";
import { PowershellCommandBuilder, quotePowerShellString } from "../../command-builder.js";
import { ARCHIVE_PROJECTION, fixedProjectionPipeline, fullOnlyInputSchema } from "../../projection.js";

export function getArchivePowerShellTool(server: McpServer, config: Config) {
    server.registerTool(
        "common-get-archive",
        {
            description: "Gets Sitecore database archives.",
            inputSchema: z.object({
                name: z.string().optional()
                    .describe("The name of the archive to retrieve."),
                database: z.string().optional()
                    .describe("The database for which the archives should be retrieved."),
                ...fullOnlyInputSchema,
            }),
        },
        async (params) => {
            const commandBuilder = new PowershellCommandBuilder();
            const parameters: Record<string, any> = {};

            if (params.name) {
                parameters["Name"] = params.name;
            }

            // Get-Archive returns a SqlArchive that serializes its whole Database inline:
            // 8,265 characters for the two archives of one database. The projection keeps
            // the archive's name and adds its entry count, which is what a caller reaches
            // for next.
            const projection = fixedProjectionPipeline(ARCHIVE_PROJECTION, params) ?? "";

            const command = `
                $database = Get-Database -Name ${quotePowerShellString(params.database)};
                Get-Archive ${commandBuilder.buildParametersString(parameters)} -database $database${projection};
            `;

            return safeMcpResponse(
                runGenericPowershellCommand(config, command, {}, undefined, { full: params.full })
            );
        }
    );
}
