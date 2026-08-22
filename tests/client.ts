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
 * internals. That helper existed to coerce CLI string arguments against the tool's
 * schema, which cost a `tools/list` round trip on every single call; the tests pass
 * already-typed arguments, so there is nothing to coerce.
 */
async function callTool(
    mcpClient: Client,
    name: string,
    args: Record<string, unknown>
): Promise<ToolCallResult> {
    try {
        return await mcpClient.callTool({ name, arguments: args }) as ToolCallResult;
    } catch (error) {
        throw new Error(`Failed to call tool ${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export { client, transport, callTool };
export type { ToolCallResult };
