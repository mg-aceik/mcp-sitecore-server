import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "../../config.js";
import { safeMcpResponse } from "../../helper.js";
import { introspection } from "./generic/introspection.js";
import { z } from "zod";
import { query } from "./generic/query.js";


function registerIntrospectionTool(server: McpServer, config: Config, schema: string) {
    server.registerTool(
        `introspection-graphql-${schema}`,
        {
            description:
                `Returns the full SDL of the Sitecore GraphQL '${schema}' schema. Call it once `
                + `before writing queries against a schema you have not seen — the SDL is large `
                + `(often 100,000+ characters), so do not re-fetch it per query, and prefer the `
                + `typed item/presentation tools when one already answers the question.`,
        },
        () => {
            return safeMcpResponse(introspection(config, schema))
        }
    )
}

function registerQueryTool(server: McpServer, config: Config, schema: string) {
    server.registerTool(
        `query-graphql-${schema}`,
        {
            description:
                `Executes a GraphQL query against the Sitecore '${schema}' endpoint and returns `
                + `the data as JSON. The query is syntax-checked before it is sent. Note what the `
                + `endpoint can see: 'edge' serves published content only (unpublished master `
                + `changes are invisible to it), while 'master' / preview schemas read the `
                + `authoring database. Use introspection-graphql-${schema} for the schema SDL.`,
            inputSchema: z.object({
                query: z.string()
                    .describe("The GraphQL query document, e.g. 'query($path: String!) { item(path: $path, language: \"en\") { id name } }'."),
                variables: z.string().optional()
                    .describe("The query's variables as a JSON object string, e.g. '{\"path\": \"/sitecore/content/Home\"}'. Parsed and sent as the GraphQL variables object."),
            }),
        },
        (params) => {
            return safeMcpResponse(query(config, schema, params.query, params.variables))
        }
    )
}

export function registerGraphQL(server: McpServer, config: Config) {
    config.graphQL.schemas.forEach((schema) => {
        registerIntrospectionTool(server, config, schema);
        registerQueryTool(server, config, schema);
    })
}