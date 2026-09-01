import type { McpServer, CallToolResult } from "@modelcontextprotocol/server";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import {
    DOCUMENTATION_CATEGORIES,
    commandIndex,
    findCommand,
    readCommandPage,
    suggestCommands,
    type CommandDoc,
} from "./documentation-index.js";

/**
 * The Sitecore PowerShell Extensions command reference, revealed progressively.
 *
 * This tool used to concatenate every command page — roughly 570KB of markdown — into a
 * single result. An agent that wanted the parameters of one cmdlet paid for the parameter
 * tables of the other 147, which on most models is a large fraction of the whole context
 * window spent to answer a small question, and often enough to make the answer worse rather
 * than better.
 *
 * It now answers in three widening steps, each a call the previous one tells you how to
 * make:
 *
 * 1. no arguments — every command name with its one-line summary, grouped by category
 *    (~9KB): enough to choose;
 * 2. `category` or `search` — a filtered slice of the same;
 * 3. `command` — the full page(s) for the one or few commands actually needed.
 *
 * There is deliberately no "give me everything" mode. That was the old behaviour, and the
 * point of this change is that it is never the right call.
 */

/** How many full pages one call may return, so step 3 cannot recreate the blob. */
const MAX_PAGES_PER_CALL = 5;

function grouped(docs: CommandDoc[]): string {
    const byCategory = new Map<string, CommandDoc[]>();
    for (const doc of docs) {
        const list = byCategory.get(doc.category) ?? [];
        list.push(doc);
        byCategory.set(doc.category, list);
    }

    const sections: string[] = [];
    for (const category of DOCUMENTATION_CATEGORIES) {
        const list = byCategory.get(category);
        if (!list || list.length === 0) {
            continue;
        }
        sections.push(
            `## ${category} (${list.length})\n\n`
            + list.map((doc) => `- **${doc.name}** — ${doc.summary || "(no description)"}`).join("\n")
        );
    }
    return sections.join("\n\n");
}

function text(body: string): CallToolResult {
    return { content: [{ type: "text", text: body }], isError: false };
}

export function getPowershellDocumentationTool(server: McpServer) {
    server.registerTool(
        "get-powershell-documentation",
        {
            description:
                "The Sitecore PowerShell Extensions command reference, for writing "
                + "run-powershell-script scripts. Reveals progressively rather than returning the "
                + "whole ~510KB corpus: call it with NO arguments first for an index of all 129 "
                + "commands with one-line summaries, then call it again with 'command' for the full "
                + "page — syntax, every parameter, and examples — of the one or few you need. "
                + "'search' matches names, summaries and page bodies when you know what you want to "
                + "do but not which cmdlet does it; 'category' lists one group. Do not fetch pages "
                + "you are not about to use.",
            inputSchema: z.object({
                command: z.union([z.string(), z.array(z.string())]).optional()
                    .describe(`The command name(s) to return full documentation for, e.g. 'Get-ItemTemplate' or ['Add-Rendering','Get-Rendering']. Case-insensitive. At most ${MAX_PAGES_PER_CALL} per call.`),
                search: z.string().optional()
                    .describe("Keyword to match against command names, summaries and page bodies — use it when you know the task ('placeholder', 'workflow', 'acl') but not the cmdlet. Returns matching names and summaries, not full pages."),
                category: z.enum(DOCUMENTATION_CATEGORIES).optional()
                    .describe("List only this group of commands: common, indexing, packaging, presentation, provider, security or session."),
            }),
        },
        async (params) => {
            return safeMcpResponse((async (): Promise<CallToolResult> => {
                const index = commandIndex();

                // Step 3: the full page(s) for named commands.
                if (params.command !== undefined) {
                    const names = Array.isArray(params.command) ? params.command : [params.command];
                    const wanted = names.map((n) => n.trim()).filter((n) => n !== "");

                    if (wanted.length === 0) {
                        throw new Error(
                            "'command' was empty. Omit it for the index of every command, or name at "
                            + "least one command."
                        );
                    }
                    if (wanted.length > MAX_PAGES_PER_CALL) {
                        throw new Error(
                            `'command' names ${wanted.length} commands; at most ${MAX_PAGES_PER_CALL} `
                            + `full pages are returned per call, because returning many is how this `
                            + `tool used to overwhelm a context window. Ask for the ones you need now.`
                        );
                    }

                    const pages: string[] = [];
                    const missing: string[] = [];
                    for (const name of wanted) {
                        const doc = findCommand(name);
                        if (doc) {
                            pages.push(readCommandPage(doc));
                        } else {
                            missing.push(name);
                        }
                    }

                    // A wholly failed lookup is an error the caller must act on; a partial one
                    // still carries the pages that were found, with a note about the rest.
                    if (pages.length === 0) {
                        const suggestions = missing.flatMap((name) => suggestCommands(name));
                        const unique = [...new Set(suggestions)];
                        throw new Error(
                            `No such command: ${missing.join(", ")}.`
                            + (unique.length > 0 ? ` Did you mean: ${unique.join(", ")}?` : "")
                            + ` Call this tool with no arguments for the full index.`
                        );
                    }

                    const note = missing.length > 0
                        ? `> Not found, and omitted below: ${missing.join(", ")}. `
                        + `Suggestions: ${[...new Set(missing.flatMap((n) => suggestCommands(n, 4)))].join(", ") || "none"}.\n\n`
                        : "";
                    return text(note + pages.join("\n\n---\n\n"));
                }

                // Step 2a: keyword search across names, summaries and bodies.
                if (params.search !== undefined && params.search.trim() !== "") {
                    const needle = params.search.trim().toLowerCase();
                    const byName = index.filter((doc) =>
                        doc.name.toLowerCase().includes(needle)
                        || doc.summary.toLowerCase().includes(needle));
                    const nameHits = new Set(byName.map((doc) => doc.name));
                    // Only read page bodies for the commands the cheap match missed.
                    const byBody = index.filter((doc) =>
                        !nameHits.has(doc.name)
                        && readCommandPage(doc).toLowerCase().includes(needle));

                    if (byName.length === 0 && byBody.length === 0) {
                        return text(
                            `No command matches '${params.search}'. Call this tool with no arguments `
                            + `for the index of all ${index.length} commands.`
                        );
                    }

                    const parts = [
                        `# SPE commands matching '${params.search}'`,
                        "",
                        `${byName.length} matched by name or description, ${byBody.length} by page content.`,
                        "",
                        "Call this tool again with `command` for a full page.",
                    ];
                    if (byName.length > 0) {
                        parts.push("", "# Matched by name or description", "", grouped(byName));
                    }
                    if (byBody.length > 0) {
                        parts.push(
                            "", "# Mentioned in the page body", "",
                            byBody.map((doc) => `- **${doc.name}** (${doc.category})`).join("\n")
                        );
                    }
                    return text(parts.join("\n"));
                }

                // Step 2b: one category.
                if (params.category !== undefined) {
                    const list = index.filter((doc) => doc.category === params.category);
                    return text(
                        `# SPE ${params.category} commands (${list.length})\n\n`
                        + "Call this tool again with `command` for a full page.\n\n"
                        + grouped(list)
                    );
                }

                // Step 1: the index.
                return text(
                    `# Sitecore PowerShell Extensions commands (${index.length})\n\n`
                    + "One line each. Call this tool again with `command: \"<name>\"` for a command's "
                    + "full page (syntax, parameters, examples), `search: \"<keyword>\"` to find a "
                    + "command by what it does, or `category: \"<name>\"` to list one group.\n\n"
                    + grouped(index)
                );
            })());
        }
    );
}
