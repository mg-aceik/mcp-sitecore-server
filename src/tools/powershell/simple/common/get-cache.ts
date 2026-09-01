import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { runGenericPowershellCommand } from "../generic.js";
import { quotePowerShellString } from "../../command-builder.js";
import { CACHE_PROJECTION, fixedProjectionPipeline, fullOnlyInputSchema } from "../../projection.js";

/**
 * Every real Sitecore cache name contains square brackets — `master[items]`,
 * `core[languageFallback]` — and `Get-Cache -Name` matches its argument as a wildcard
 * pattern, in which `[...]` is a character class. So the obvious call, passing the name
 * the tool itself just reported, matched nothing and returned an empty result with no
 * error to explain it.
 *
 * Backtick-escaping the brackets is not available: `PowershellCommandBuilder` renders
 * values as single-quoted literals, where a backtick carries no meaning. So the match is
 * done here instead — `-eq` for a literal name, and `-like` only when the caller actually
 * used a wildcard metacharacter. That makes the reported name a valid input, which is the
 * property that was missing.
 */
function cacheFilterPipeline(name: string): string {
    const quoted = quotePowerShellString(name);
    const operator = /[*?]/.test(name) ? "-like" : "-eq";
    return ` | Where-Object { $_.Name ${operator} ${quoted} }`;
}

export function getCachePowerShellTool(server: McpServer, config: Config) {
    server.registerTool(
        "common-get-cache",
        {
            description:
                "Gets information about Sitecore caches, with their size and occupancy. Omit name to "
                + "return every cache. Cache names contain square brackets ('master[items]'); pass one "
                + "exactly as reported and it is matched literally, or use * / ? for a wildcard.",
            inputSchema: z.object({
                name: z.string().optional()
                    .describe("The name of the cache to retrieve, e.g. 'master[items]'. Use * or ? for wildcard matching. If not provided, all caches will be returned."),
                ...fullOnlyInputSchema,
            }),
        },
        async (params) => {
            // `database` used to be offered here. Get-Cache has one parameter set,
            // `[[-Name] <string>]`, so it had nothing to bind to.
            const command = `Get-Cache`;

            const filter = params.name ? cacheFilterPipeline(params.name) : "";
            const projection = fixedProjectionPipeline(CACHE_PROJECTION, params) ?? "";
            const pipeline = filter + projection;

            return safeMcpResponse(
                runGenericPowershellCommand(config, command, {}, undefined, {
                    pipeline: pipeline || undefined,
                    full: params.full,
                })
            );
        }
    );
}
