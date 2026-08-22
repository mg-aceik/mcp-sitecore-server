import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { runGenericPowershellCommand } from "../../simple/generic.js";
import { PowershellCommandBuilder, quotePowerShellString } from "../../command-builder.js";
import { ARCHIVE_ENTRY_PROJECTION, fixedProjectionPipeline, fullOnlyInputSchema } from "../../projection.js";

/**
 * Paging is not optional here. A recycle bin is a tail that nobody trims: the sandbox CM's
 * held ~9,800 entries, and an unfiltered call returned roughly 3.3 million characters even
 * after Tier 0's projection. So the tool returns a page and says how big the archive is,
 * rather than returning everything and letting the caller discover the size by paying for
 * it.
 */
const FIRST_DESCRIPTION =
    "How many entries to return, starting after 'skip'. Defaults to 100. An archive routinely "
    + "holds thousands of entries, so raise this deliberately rather than by habit.";

const SKIP_DESCRIPTION =
    "How many entries to skip before returning any. Defaults to 0. Combine with 'first' to "
    + "page through the archive; 'Total' in the response says how many entries there are.";

export function getArchiveItemPowerShellTool(server: McpServer, config: Config) {
    server.registerTool(
        "common-get-archive-item",
        {
            description: "Gets a page of the items found in the specified archive, with the archive's total entry count. Returns the 100 most recently archived entries unless first/skip say otherwise.",
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
                first: z.number().int().positive().optional().default(100).describe(FIRST_DESCRIPTION),
                skip: z.number().int().nonnegative().optional().default(0).describe(SKIP_DESCRIPTION),
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

            // The projection is appended to the paging statement rather than passed as a
            // shaping option, because this command is a multi-statement script and the
            // pipeline has to attach to the entries, not to the script.
            const projection = fixedProjectionPipeline(ARCHIVE_ENTRY_PROJECTION, params) ?? "";

            const command = `
                $database = Get-Database -Name ${quotePowerShellString(params.database)};
                $archive = Get-Archive -Database $database -Name ${quotePowerShellString(params.archive)};
                $entries = @(Get-ArchiveItem ${commandBuilder.buildParametersString(parameters)} -Archive $archive);
                $page = @($entries | Select-Object -Skip ${params.skip} -First ${params.first}${projection});
                [PSCustomObject]@{
                    Archive = ${quotePowerShellString(params.archive)};
                    Total = $entries.Count;
                    Skip = ${params.skip};
                    First = ${params.first};
                    Returned = $page.Count;
                    Items = $page;
                };
            `;

            return safeMcpResponse(runGenericPowershellCommand(config, command, {}, undefined, {
                full: params.full,
            }));
        }
    );
}
