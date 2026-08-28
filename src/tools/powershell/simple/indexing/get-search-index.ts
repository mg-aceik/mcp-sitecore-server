import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { runGenericPowershellCommand } from "../generic.js";
import { SEARCH_INDEX_PROJECTION, fixedProjectionPipeline, fullOnlyInputSchema } from "../../projection.js";

export function getSearchIndexPowerShellTool(server: McpServer, config: Config) {
    server.registerTool(
        "indexing-get-search-index",
        {
            description:
                "Get information about Sitecore search indexes, addressed by name. SPE's Get-SearchIndex "
                + "takes no other filter, so filter the returned rows rather than asking the CM to. "
                + "IndexingState (Started / Stopped) is reliable; the Summary fields "
                + "(NumberOfDocuments, IsHealthy, IsClean, OutOfDateIndex) come from the search "
                + "provider and are not dependable everywhere — on an XM Cloud CM, where every index "
                + "shares one Solr core, NumberOfDocuments reads 0 and IsHealthy false on an index that "
                + "is serving queries perfectly well. Run an actual query with indexing-find-item "
                + "before concluding an index is broken.",
            inputSchema: z.object({
                name: z.string().optional()
                    .describe("The name of the index to retrieve information for. Supports wildcards. Omit to return every index."),
                ...fullOnlyInputSchema,
            }),
        },
        async (params) => {
            const command = `Get-SearchIndex`;
            const options: Record<string, any> = {};

            if (params.name) {
                options["Name"] = params.name;
            }

            // `database`, `running` and `corrupted` used to be offered here. SPE's
            // Get-SearchIndex has exactly one parameter set -- `[-Name <string>]` -- so
            // each of those failed the entire call with "A parameter cannot be found that
            // matches parameter name 'Running'". They are gone rather than reimplemented:
            // the projection below surfaces the same three facts as fields, which is a
            // filter the caller can apply without a round trip.
            const pipeline = fixedProjectionPipeline(SEARCH_INDEX_PROJECTION, params);

            return safeMcpResponse(
                runGenericPowershellCommand(config, command, options, undefined, {
                    pipeline,
                    full: params.full,
                })
            );
        }
    );
}
