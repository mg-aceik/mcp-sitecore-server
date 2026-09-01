import type { CallToolResult } from "@modelcontextprotocol/server";
import { buildClientSchema, getIntrospectionQuery } from "graphql";
import { type IntrospectionQuery } from "graphql";
import { type Config } from "@/config.js";
import { fetchWithTimeout } from "@/utils.js";
import { type SchemaSliceParams, sliceSchema } from "../schema-slice.js";

/**
 * The delivery schemas are template-generated, so the interesting part is small and fixed
 * while the bulk is repetition. Naming `Item` here puts the interface every result
 * implements — `field(name:)`, `fields`, `children`, `template`, `url` — into the default
 * response, because that plus the four root fields is the whole contract a caller needs.
 * `ItemField` is what `field(name:)` returns, so it is only useful alongside it.
 */
const EDGE_INDEX_TYPES = ["Item", "ItemField"];

export async function introspection(
    conf: Config,
    schemaName: string,
    params: SchemaSliceParams = {}
): Promise<CallToolResult> {
    
    const url = `${conf.graphQL.endpoint}/${schemaName}`;

    const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            // Pass the API key as a header rather than a query-string parameter so it
            // is not captured in access logs, proxies or browser history.
            'sc_apikey': conf.graphQL.apiKey,
            ...conf.graphQL.headers,
        },
        body: JSON.stringify({
            query: getIntrospectionQuery(),
        }),
    });

    if (!response.ok) {
		throw new Error(`GraphQL request failed: ${response.statusText}`);
	}

	const responseJson = await response.json() as unknown as { data: IntrospectionQuery };
	// Transform to a schema object
	const schema = buildClientSchema(responseJson.data);

	return {
        content: [
            {
                type: "text",
                text: sliceSchema(schema, params, {
                    label: `Sitecore GraphQL '${schemaName}' schema`,
                    toolName: `introspection-graphql-${schemaName}`,
                    indexIncludeTypes: EDGE_INDEX_TYPES,
                }),
            },
        ],
        isError: false,
    }
}