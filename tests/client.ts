import { Client } from "@modelcontextprotocol/client";
import { getDefaultEnvironment, StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

// The integration suite runs against the bundle, because `dist/bundle.js` is the
// published `bin` -- the artifact people actually run via npx. Testing the loose
// `dist/index.js` would leave the rollup step unproven.
const serverEntry = path.resolve(here, "..", "dist", "bundle.js");

// Pinned to the 2026-07-28 revision so the suite proves the modern era serves every
// tool it is asked for; `mode: 'auto'` would quietly fall back to the 2025 handshake
// and hide a regression. Set MCP_PROTOCOL_ERA=legacy to run the same suite against
// the 2025 handshake instead.
const mode = process.env.MCP_PROTOCOL_ERA === "legacy"
    ? "legacy" as const
    : { pin: "2026-07-28" };

const client = new Client(
    {
        name: "mcp-sitecore-server",
        version: "2.0.0",
    },
    {
        versionNegotiation: { mode },
    }
);

// The whole of `process.env` is forwarded on top of the SDK's safe default set,
// because that is what the inspector's `createTransport` did and the suite's Sitecore
// credentials (POWERSHELL_*, ITEM_SERVICE_*, GRAPHQL_*) arrive that way -- from the
// shell or from a local .env dotenv picks up in the child.
const env: Record<string, string> = { ...getDefaultEnvironment() };
for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
        env[key] = value;
    }
}

const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverEntry],
    env,
    stderr: "pipe",
});

/**
 * The shape the suite reads off a tool result: `result.content[0].text`, mostly, then
 * `JSON.parse` on it. The SDK's own `CallToolResult` types `content` as a discriminated
 * union over text/image/audio/resource blocks, which would make every one of those reads
 * a narrowing exercise for no gain -- these tools only ever return text.
 */
type ToolCallResult = {
    content: Array<Record<string, any>>;
    isError?: boolean;
    [key: string]: any;
};

/**
 * Calls a tool and returns its result.
 *
 * This replaces the `callTool` the suite used to import from the MCP inspector's CLI
 * internals. That helper coerced CLI string arguments against the tool's schema, at the
 * cost of a `tools/list` round trip per call. The arguments here are typed in the tests
 * instead, which is what a real MCP client sends — so nothing is coerced, deliberately:
 * a test that passes `"true"` where the schema says `z.boolean()` is testing something no
 * client would ever do, and coercing would hide that.
 *
 * What is *not* deliberate is how such a mismatch used to surface. The server answers an
 * invalid call with a normal result whose text is "Input validation failed: ...", so the
 * test's own `JSON.parse(result.content[0].text)` threw
 * `Unexpected token 'I', "Input vali"... is not valid JSON` — a message that says nothing
 * about the schema and points at the test's parse line. Fifty-one tests failed that way
 * and read as though Sitecore were unreachable. Catching it here names the real problem.
 */
async function callTool(
    mcpClient: Client,
    name: string,
    args: Record<string, unknown>
): Promise<ToolCallResult> {
    let result: ToolCallResult;
    try {
        result = await mcpClient.callTool({ name, arguments: args }) as ToolCallResult;
    } catch (error) {
        throw new Error(`Failed to call tool ${name}: ${error instanceof Error ? error.message : String(error)}`);
    }

    const text = result.content?.map((block) => block.text ?? "").join("\n") ?? "";
    // The SDK has worded this both ways ("Input validation error: Invalid arguments for
    // tool ..." on the v2 server), so match the stem rather than a full phrase.
    if (/^Input validation/.test(text)) {
        throw new Error(
            `Tool ${name} rejected its arguments before reaching Sitecore. This is a schema `
            + `mismatch in the test, not an endpoint failure — most often a string where the `
            + `schema declares z.boolean() or z.number(). Arguments: `
            + `${JSON.stringify(args)}\nServer said: ${text}`
        );
    }

    return result;
}

export { client, transport, callTool };
export type { ToolCallResult };
