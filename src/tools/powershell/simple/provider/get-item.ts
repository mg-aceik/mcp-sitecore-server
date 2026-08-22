import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { requireOneTarget } from "@/tools/target-input.js";
import { runGenericPowershellCommand } from "../generic.js";
import { itemProjectionInputSchema, itemProjectionPipeline } from "../../projection.js";

/**
 * Four tools became one: `Get-Item` addresses an item by path, ID, Sitecore query or URI,
 * and all four went through the same options, projection and error shaping.
 *
 * `-ID`, `-Query` and `-Uri` all need a provider drive to resolve against, which the
 * variant tools supplied as a `path` defaulting to `master:`. `path` is now one of the
 * addressing inputs, so those three branches build the drive from `database` instead —
 * the parameter that already meant "which database", now with a documented default.
 */
export function getItemPowerShellTool(server: McpServer, config: Config) {
    server.registerTool(
        "provider-get-item",
        {
            description: "Gets a Sitecore item by path, ID, Sitecore query or URI.",
            inputSchema: {
                ...itemProjectionInputSchema,
                path: z.string().optional()
                    .describe("The path of the item to retrieve (e.g. /sitecore/content/Home). Supply exactly one of path, id, query or uri."),
                id: z.string().optional()
                    .describe("The ID of the item to retrieve (e.g. {110D559F-DEA5-42EA-9C1C-8A5DF7E70EF9}). Supply exactly one of path, id, query or uri."),
                query: z.string().optional()
                    .describe("The Sitecore query to execute (e.g. /sitecore/content/home/*/*). Supply exactly one of path, id, query or uri."),
                uri: z.string().optional()
                    .describe("The URI of the item to retrieve (e.g. sitecore://master/home). Supply exactly one of path, id, query or uri."),
                database: z.string().optional()
                    .describe("The database containing the item. Defaults to master, and is also the drive an id, query or uri resolves against."),
                language: z.string().optional()
                    .describe("The language of the item to retrieve"),
                version: z.string().optional()
                    .describe("The version of the item to retrieve"),
            },
        },
        async (params) => {
            const invalid = requireOneTarget(params, ["path", "id", "query", "uri"]);
            if (invalid) {
                return invalid;
            }

            const command = `Get-Item`;
            const drive = `${params.database || "master"}:`;

            const options: Record<string, any> = params.path
                ? { "Path": params.path }
                : params.id
                    ? { "ID": params.id, "Path": drive }
                    : params.query
                        ? { "Query": params.query, "Path": drive }
                        : { "Uri": params.uri, "Path": drive };

            if (params.database) {
                options["Database"] = params.database;
            }

            if (params.language) {
                options["Language"] = params.language;
            }

            if (params.version) {
                options["Version"] = params.version;
            }

            return safeMcpResponse(runGenericPowershellCommand(config, command, options, undefined, {
                full: params.full,
                pipeline: itemProjectionPipeline(params),
            }));
        }
    );
}
