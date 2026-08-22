import type { CallToolResult } from "@modelcontextprotocol/server";
import { buildClientSchema, getIntrospectionQuery, printSchema } from "graphql";
import { type IntrospectionQuery } from "graphql";
import { type Config } from "@/config.js";
import { parse } from "graphql/language/index.js";
import { fetchWithTimeout } from "@/utils.js";

export async function query(conf: Config, schemaName:string, query: string, variables?: string): Promise<CallToolResult> {
    const url = `${conf.graphQL.endpoint}/${schemaName}`;

    // Validate the query syntax before sending it to the server.
    parse(query);

    // The MCP parameter is a JSON string; GraphQL servers expect `variables` to be a
    // JSON object in the request body, not a string, so parse it here and fail with a
    // clear message rather than the server's opaque 400.
    let parsedVariables: unknown;
    if (variables !== undefined && variables !== "") {
        try {
            parsedVariables = JSON.parse(variables);
        } catch {
            throw new Error(
                `The 'variables' parameter must be a JSON object string, e.g. '{"path": "/sitecore/content/Home"}'. Got: ${variables}`
            );
        }
    }

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
            query,
            variables: parsedVariables,
        }),
    });

    if (!response.ok) {
        throw new Error(`GraphQL request failed: ${response.statusText}`);
    }

    const responseJson = await response.json();

    if (responseJson.errors && responseJson.errors.length > 0) {
        throw new Error(`GraphQL query errors: ${JSON.stringify(responseJson.errors)}`);
    }

    return {
        content: [
            {
                type: "text",
                text: responseJson.data ? JSON.stringify(responseJson.data, null, 2) : "No data returned",
            },
        ],
        isError: false,
    }
}