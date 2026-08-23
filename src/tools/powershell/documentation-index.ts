import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * The bundled Sitecore PowerShell Extensions command reference, indexed for progressive
 * reveal.
 *
 * The whole corpus is 148 command pages and about 570KB of markdown. Returning all of it
 * in one tool result — which is what this tool used to do — spends an enormous amount of a
 * model's context to answer a question about one cmdlet, and most of it is parameter
 * tables for commands the caller will never touch. So the corpus is indexed once and
 * served in three widening steps: the index, then a category, then the full page for the
 * commands actually wanted.
 *
 * The pages are a vendored copy of the SPE Book (`SitecorePowerShell/Book`,
 * `appendix/<category>/*.md`), kept verbatim so they can be re-synced by comparing bytes.
 */

/** The category folders, which are SPE's own grouping of its commands. */
export const DOCUMENTATION_CATEGORIES = [
    "common",
    "indexing",
    "packaging",
    "presentation",
    "provider",
    "security",
    "session",
] as const;

export type DocumentationCategory = (typeof DOCUMENTATION_CATEGORIES)[number];

export type CommandDoc = {
    /** The command name as SPE spells it, e.g. `Add-BaseTemplate`. */
    name: string;
    category: DocumentationCategory;
    /** The one-line description under the heading. */
    summary: string;
    /** Absolute path to the markdown page. */
    file: string;
};

/**
 * Where the markdown lives.
 *
 * Two layouts have to work, because the module that reads the docs sits in a different
 * place in each:
 *
 * - the loose build (`dist/tools/powershell/documentation-index.js`), where the pages are
 *   in `documentation/` next to this file; and
 * - the rollup bundle (`dist/bundle.js`), which is the package's `bin` — the file people
 *   actually run via `npx`. There, `import.meta.url` resolves to `dist/`, and the pages
 *   are at `dist/tools/powershell/documentation`.
 *
 * The old code only ever tried the first, so `get-powershell-documentation` failed with
 * `ENOENT ... dist\documentation` for every user of the published package, while working
 * fine in local development against `dist/index.js`. Trying the known layouts in order
 * fixes that and keeps working if the bundle output moves again.
 */
function resolveDocumentationDir(): string {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const candidates = [
        // Loose build: alongside this module.
        path.resolve(here, "documentation"),
        // Bundled: this module has been flattened into dist/bundle.js.
        path.resolve(here, "tools", "powershell", "documentation"),
        // Bundle emitted into a subdirectory.
        path.resolve(here, "..", "tools", "powershell", "documentation"),
    ];

    for (const candidate of candidates) {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
            return candidate;
        }
    }

    throw new Error(
        `The Sitecore PowerShell command reference is not installed alongside this build. `
        + `Looked in: ${candidates.join(", ")}. If you are running from source, run `
        + `'npm run build'; if from the published package, this is a packaging fault.`
    );
}

/**
 * Reads a page's command name and one-line summary.
 *
 * The pages are machine-generated from SPE's own help, so the shape is dependable: an `#`
 * heading carrying the command name, then a blank line, then a one-sentence description
 * before the `## Syntax` heading. The filename is the fallback for the name, because a
 * name that goes missing would make the command unaddressable.
 */
function readHeader(file: string): { name: string; summary: string } {
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
    const fallback = path.basename(file, ".md");

    let name = "";
    const summaryParts: string[] = [];
    for (const line of lines) {
        const trimmed = line.trim();
        if (!name) {
            const heading = /^#\s+(.+)$/.exec(trimmed);
            if (heading) {
                name = heading[1].trim();
            }
            continue;
        }
        // Stop at the next heading: everything between is the description.
        if (trimmed.startsWith("#")) {
            break;
        }
        if (trimmed !== "") {
            summaryParts.push(trimmed);
        } else if (summaryParts.length > 0) {
            // One paragraph is enough for an index line.
            break;
        }
    }

    return { name: name || fallback, summary: summaryParts.join(" ") };
}

let cached: CommandDoc[] | undefined;

/**
 * The index, built once per process.
 *
 * 148 small reads is a few milliseconds, but it happens on every tool call otherwise, and
 * the HTTP transport builds a fresh server per request — so it would be every request.
 */
export function commandIndex(): CommandDoc[] {
    if (cached) {
        return cached;
    }

    const root = resolveDocumentationDir();
    const docs: CommandDoc[] = [];

    for (const category of DOCUMENTATION_CATEGORIES) {
        const dir = path.join(root, category);
        if (!fs.existsSync(dir)) {
            continue;
        }
        for (const entry of fs.readdirSync(dir)) {
            if (!entry.endsWith(".md") || entry.toLowerCase() === "readme.md") {
                continue;
            }
            const file = path.join(dir, entry);
            const { name, summary } = readHeader(file);
            docs.push({ name, category, summary, file });
        }
    }

    docs.sort((a, b) => a.name.localeCompare(b.name));
    cached = docs;
    return docs;
}

/** Test seam: forget the built index. */
export function resetCommandIndex(): void {
    cached = undefined;
}

/**
 * Finds a command by name, case-insensitively.
 *
 * A caller may reasonably write `get-item`, `Get-Item` or `GET-ITEM`, and PowerShell
 * itself is case-insensitive, so matching case-sensitively would reject spellings the
 * shell accepts.
 */
export function findCommand(name: string): CommandDoc | undefined {
    const wanted = name.trim().toLowerCase();
    return commandIndex().find((doc) => doc.name.toLowerCase() === wanted);
}

/** The full markdown page for a command. */
export function readCommandPage(doc: CommandDoc): string {
    return fs.readFileSync(doc.file, "utf8");
}

/**
 * Suggests near-miss names for a command that was not found.
 *
 * An agent that guessed `Get-ItemTemplates` should be told `Get-ItemTemplate` exists
 * rather than just "not found", which invites the same guess again.
 */
export function suggestCommands(name: string, limit = 8): string[] {
    const wanted = name.trim().toLowerCase();
    const bare = wanted.replace(/[^a-z]/g, "");
    const scored: Array<{ name: string; score: number; distance: number }> = [];

    for (const doc of commandIndex()) {
        const candidate = doc.name.toLowerCase();
        const candidateBare = candidate.replace(/[^a-z]/g, "");
        let score = 0;
        if (candidate.includes(wanted) || wanted.includes(candidate)) {
            score = 3;
        } else if (candidateBare.includes(bare) || bare.includes(candidateBare)) {
            score = 2;
        } else {
            // Share a verb (Get-, Set-) or a noun (-Item), which is how these names are built.
            const [verb, ...rest] = candidate.split("-");
            const [wantedVerb, ...wantedRest] = wanted.split("-");
            if (rest.join("-") && rest.join("-") === wantedRest.join("-")) {
                score = 2;
            } else if (verb === wantedVerb) {
                score = 1;
            }
        }
        if (score > 0) {
            scored.push({
                name: doc.name,
                score,
                // Within a score band, the nearest-length name is the likelier intent:
                // `Get-ItemTemplates` contains both `Get-Item` and `Get-ItemTemplate`, and
                // it is plainly the latter that was meant.
                distance: Math.abs(candidate.length - wanted.length),
            });
        }
    }

    scored.sort((a, b) =>
        b.score - a.score
        || a.distance - b.distance
        || a.name.localeCompare(b.name));
    return scored.slice(0, limit).map((entry) => entry.name);
}
