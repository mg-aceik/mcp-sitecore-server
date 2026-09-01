import type { CallToolResult } from "@modelcontextprotocol/server";
import { type Config } from "@/config.js";
import { executeAuthoringGraphQL } from "../client.js";

/**
 * Runs one Authoring and Management document and renders its `data` as the tool result.
 *
 * Every typed tool in this folder funnels through here, so the JSON shape an agent sees is
 * the same whichever tool produced it, and error handling lives in exactly one place.
 */
export async function runAuthoringOperation(
    conf: Config,
    query: string,
    variables?: Record<string, unknown>
): Promise<CallToolResult> {
    const data = await executeAuthoringGraphQL(conf, query, variables);

    return {
        content: [
            {
                type: "text",
                text: data === undefined || data === null
                    ? "No data returned"
                    : JSON.stringify(data, null, 2),
            },
        ],
        isError: false,
    };
}
