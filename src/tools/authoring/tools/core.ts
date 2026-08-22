import type { McpServer } from "@modelcontextprotocol/server";
import type { CallToolResult } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { buildClientSchema, printSchema, parse } from "graphql";
import { type IntrospectionQuery } from "graphql";
import { safeMcpResponse } from "@/helper.js";
import { executeAuthoringGraphQL } from "../client.js";
import { authoringIntrospectionQuery } from "../logic/introspection-query.js";
import { runAuthoringOperation } from "../logic/run.js";

/**
 * The two tools that make the whole Authoring and Management surface reachable: the SDL,
 * and a way to send any document at all.
 *
 * The typed tools alongside them cover the operations Sitecore documents, but the schema is
 * far larger than that -- workflow, archiving, rules, security, language, database -- and
 * it grows with each release. These two are the escape hatch that keeps a capability
 * available even when no typed tool wraps it.
 */

export function authoringIntrospectionTool(server: McpServer, config: Config) {
    server.registerTool(
        "authoring-introspect-schema",
        {
            description:
                "Returns the full SDL of the Sitecore Authoring and Management GraphQL schema "
                + "(items, templates, media, sites, search, publishing, jobs, indexing, workflow, "
                + "security). Call it once before writing a document for an operation no typed "
                + "authoring-* tool covers — the SDL is large (100,000+ characters), so do not "
                + "re-fetch it per query. This is the authoring/management schema on the CM, not "
                + "the Edge schema that introspection-graphql-* returns.",
        },
        () => {
            return safeMcpResponse((async (): Promise<CallToolResult> => {
                // Not graphql-js's getIntrospectionQuery(): it nests deeper than this
                // endpoint's depth cap allows. See logic/introspection-query.ts.
                const data = await executeAuthoringGraphQL(config, authoringIntrospectionQuery());
                const schema = buildClientSchema(data as unknown as IntrospectionQuery);
                return {
                    content: [{ type: "text", text: printSchema(schema) }],
                    isError: false,
                };
            })());
        }
    );
}

export function authoringQueryTool(server: McpServer, config: Config) {
    server.registerTool(
        "authoring-graphql",
        {
            description:
                "Executes any query or mutation against the Sitecore Authoring and Management "
                + "GraphQL API and returns the data as JSON. The document is syntax-checked before "
                + "it is sent. Unlike the Edge endpoint, this one reads and writes the authoring "
                + "databases, so unpublished content is visible and mutations take effect "
                + "immediately. Prefer a typed authoring-* tool when one covers the operation; use "
                + "this for the rest of the schema, with authoring-introspect-schema for the SDL. "
                + "The API supports no subscriptions, and rejects GET — everything goes over POST, "
                + "which this tool does for you.",
            // Syntax-checked only, so a mutation goes through as readily as a query. Claiming
            // readOnlyHint would be a promise this tool cannot keep.
            annotations: {
                title: "Authoring GraphQL",
                readOnlyHint: false,
                destructiveHint: true,
                openWorldHint: true,
            },
            inputSchema: z.object({
                query: z.string()
                    .describe("The GraphQL document, e.g. 'query { sites { name rootPath } }' or a mutation."),
                variables: z.string().optional()
                    .describe("The document's variables as a JSON object string, e.g. '{\"itemId\": \"{110D559F-DEA5-42EA-9C1C-8A5DF7E70EF9}\"}'."),
            }),
        },
        (params) => {
            return safeMcpResponse((async () => {
                // Fail on a malformed document here rather than sending it, so the agent gets a
                // parse error pointing at its own syntax instead of the server's 400.
                parse(params.query);

                let variables: Record<string, unknown> | undefined;
                if (params.variables !== undefined && params.variables.trim() !== "") {
                    try {
                        variables = JSON.parse(params.variables);
                    } catch {
                        throw new Error(
                            `The 'variables' parameter must be a JSON object string, e.g. `
                            + `'{"path": "/sitecore/content/Home"}'. Got: ${params.variables}`
                        );
                    }
                }

                return runAuthoringOperation(config, params.query, variables);
            })());
        }
    );
}
