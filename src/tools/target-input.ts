import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/**
 * The addressing discriminator shared by the merged tools.
 *
 * Tier 2 folded the server's `-by-id` / `-by-path` / `-by-unique-id` / `-by-query` /
 * `-by-uri` tool families into one tool per operation. What used to be the tool *name*
 * is now an input: a merged tool takes `id` and `path` (plus `uniqueId`, `query` or `uri`
 * where the family had them), all optional, and exactly one must be supplied.
 *
 * The check runs here, in TypeScript, before any PowerShell is built or sent. Two reasons:
 *
 * - Zero inputs has no sensible default. Guessing an item — the database root, the context
 *   item — is how the wrong item gets written to.
 * - Two inputs is ambiguous, and silently preferring one of them means a call that named
 *   two different items did something the caller did not ask for. Sitecore's own cmdlets
 *   would accept `-Id` and `-Path` together and resolve them in an order the caller cannot
 *   see, so this is exactly the failure worth catching early.
 *
 * The error names the valid inputs, because an agent's next action is to re-call with the
 * right one.
 */

/** Renders `['id', 'path']` as `'id' or 'path'`, and longer lists with commas. */
export function describeTargetInputs(names: readonly string[]): string {
    const quoted = names.map((name) => `'${name}'`);
    if (quoted.length <= 1) {
        return quoted.join("");
    }
    return `${quoted.slice(0, -1).join(", ")} or ${quoted[quoted.length - 1]}`;
}

/**
 * True when the caller actually named a target with this input. An empty or blank string
 * is not a target: it reaches the cmdlet as an empty `-Path`, which either errors deep in
 * PowerShell or resolves to something unintended.
 */
function isSupplied(value: unknown): boolean {
    if (value === undefined || value === null) {
        return false;
    }
    return typeof value === "string" ? value.trim() !== "" : true;
}

/** The inputs of `names` that the caller supplied, in the order the tool declares them. */
export function suppliedTargets(
    params: Record<string, unknown>,
    names: readonly string[]
): string[] {
    return names.filter((name) => isSupplied(params[name]));
}

/**
 * Validates the addressing inputs of a merged tool.
 *
 * Returns `undefined` when exactly one was supplied — the caller then branches on which
 * one — and an error `CallToolResult` otherwise, which the caller returns as-is. Returning
 * rather than throwing keeps the message intact: `safeMcpResponse` would wrap a thrown
 * error in "Error executing tool:", which reads like a server fault rather than a call the
 * agent can fix.
 */
export function requireOneTarget(
    params: Record<string, unknown>,
    names: readonly string[]
): CallToolResult | undefined {
    const supplied = suppliedTargets(params, names);
    if (supplied.length === 1) {
        return undefined;
    }

    const alternatives = describeTargetInputs(names);
    const text = supplied.length === 0
        ? `Supply exactly one of ${alternatives}. None was supplied, and there is no default `
        + `item to fall back on.`
        : `Supply exactly one of ${alternatives}. ${supplied.length} were supplied `
        + `(${supplied.map((name) => `'${name}'`).join(", ")}), and one call cannot mean two items.`;

    return { isError: true, content: [{ type: "text", text }] };
}
