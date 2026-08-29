import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { runGenericPowershellCommand } from "../../simple/generic.js";

/**
 * `indexing-suspend-search-index`, `-stop-search-index` and `-resume-search-index` merged.
 *
 * All three took the same single optional `name` and differed only in the cmdlet verb, so the
 * verb becomes an input. They are genuine alternatives — an index is running, paused or
 * stopped — which is what makes an enum the right shape here.
 *
 * `indexing-rebuild-search-index` is deliberately left out. It reads like a fourth state but
 * is a *rebuild*, with its own item scoping and `includeRemoteIndex` parameter; folding it in
 * would put parameters on the schema that are meaningless for three of the four values.
 */
export function setSearchIndexStatePowerShellTool(server: McpServer, config: Config) {
    server.registerTool(
        "indexing-set-search-index-state",
        {
            description:
                "Suspends, stops or resumes Sitecore search indexes. Omit name to act on every "
                + "index in the matching state. To rebuild an index use "
                + "indexing-rebuild-search-index; to read the current state use "
                + "indexing-get-search-index.",
            annotations: {
                readOnlyHint: false,
                destructiveHint: false,
            },
            inputSchema: z.object({
                action: z.enum(["suspend", "stop", "resume"])
                    .describe("suspend pauses a running index, stop halts it, resume restarts a paused one."),
                name: z.string().optional()
                    .describe("The index to act on. Omit to act on all indexes in the matching state."),
            }),
        },
        async (params) => {
            const command = {
                suspend: `Suspend-SearchIndex`,
                stop: `Stop-SearchIndex`,
                resume: `Resume-SearchIndex`,
            }[params.action];

            const options: Record<string, any> = {};

            if (params.name) {
                options["Name"] = params.name;
            }

            return safeMcpResponse(runGenericPowershellCommand(config, command, options));
        }
    );
}
