import type { McpServer, ToolAnnotations } from "@modelcontextprotocol/server";

// Tokens (matched against the hyphen-delimited segments of a tool name) that mark a
// tool as performing a destructive change — deleting content, clearing state, or
// otherwise doing something that is not safely reversible.
const DESTRUCTIVE_TOKENS = new Set([
    "delete",
    "remove",
    "reset",
    "clear",
    "restart",
    "disable",
    "drop",
]);

// Tokens that mark a tool as writing/modifying state but in a non-destructive way.
const WRITE_TOKENS = new Set([
    "create",
    "add",
    "set",
    "new",
    "edit",
    "update",
    "publish",
    "invoke",
    "merge",
    "switch",
    "convert",
    "restore",
    "initialize",
    "resume",
    "suspend",
    "stop",
    "lock",
    "unlock",
    "protect",
    "unprotect",
    "enable",
    // export writes serialized files on the server; import overwrites the live
    // user/role with the serialized state.
    "export",
    "import",
    // upload creates or overwrites a media item ("download" stays read-only: it does
    // not mutate Sitecore).
    "upload",
]);

/**
 * Infers MCP tool annotations from a tool name using its hyphen-delimited tokens.
 *
 * The naming convention across this server is consistent enough that the leading
 * verb reliably indicates intent (get-* reads, delete-/remove-* destroy, set-/add-*
 * write). Matching on whole tokens (not substrings) avoids false positives such as
 * "unlock" matching "lock" or "unprotect" matching "protect".
 *
 * No `title` is inferred, deliberately. A title derived from the tool name only restates a
 * field the client already has: 134 of this server's 136 titles were exactly that, costing
 * roughly 4,800 characters of every `tools/list` — paid on every turn — to say that
 * `common-get-item-field` displays as "Common Get Item Field". Any client that wants it can
 * derive it. The two tools whose title says something the name does not ("Authoring
 * GraphQL", "Query GraphQL edge") set it explicitly in their own config, and
 * `withInferredAnnotations` leaves an explicit `annotations` object alone.
 */
export function inferToolAnnotations(name: string): ToolAnnotations {
    const normalized = name.toLowerCase();

    // run-powershell-script executes arbitrary PowerShell — treat it as the most
    // dangerous, open-world tool.
    if (normalized === "run-powershell-script") {
        return { readOnlyHint: false, destructiveHint: true, openWorldHint: true };
    }

    const tokens = normalized.split("-");
    const isDestructive = tokens.some((t) => DESTRUCTIVE_TOKENS.has(t));
    if (isDestructive) {
        return { readOnlyHint: false, destructiveHint: true };
    }

    const isWrite = tokens.some((t) => WRITE_TOKENS.has(t));
    if (isWrite) {
        return { readOnlyHint: false, destructiveHint: false };
    }

    return { readOnlyHint: true };
}

/**
 * Patches `server.registerTool` so that every tool registered afterwards automatically
 * gets inferred annotations (unless the caller already supplied its own in the config
 * object). This centralizes annotation metadata instead of repeating it across ~140 tool
 * files.
 */
export function withInferredAnnotations(server: McpServer): McpServer {
    const originalRegisterTool = server.registerTool.bind(server) as (...args: any[]) => any;

    (server as any).registerTool = (name: string, config: Record<string, any>, cb: any) => {
        // Respect explicitly-provided annotations; otherwise infer them from the tool name.
        const annotations = config?.annotations ?? inferToolAnnotations(name);
        return originalRegisterTool(name, { ...config, annotations }, cb);
    };

    return server;
}
