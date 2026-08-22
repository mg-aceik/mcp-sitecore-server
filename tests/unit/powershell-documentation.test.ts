import { describe, it, expect, beforeEach } from "vitest";
import {
    DOCUMENTATION_CATEGORIES,
    commandIndex,
    findCommand,
    readCommandPage,
    resetCommandIndex,
    suggestCommands,
} from "../../src/tools/powershell/documentation-index";

/**
 * The bundled SPE command reference and its index.
 *
 * These read the real corpus rather than a fixture, because the corpus *is* the thing under
 * test: it is a vendored copy of the SPE Book, and a page that loses its heading or its
 * description silently degrades the index the tool is built on.
 */

describe("commandIndex", () => {
    beforeEach(() => {
        resetCommandIndex();
    });

    it("indexes every bundled command page", () => {
        const index = commandIndex();
        // 148 pages across the seven category folders: upstream's appendix minus
        // packaging/import-item-1.md, which was a byte-identical duplicate of import-item.md.
        expect(index.length).toBe(148);
    });

    it("gives every command a name and a category", () => {
        for (const doc of commandIndex()) {
            expect(doc.name).toMatch(/^[A-Za-z]+-[A-Za-z0-9]+$/);
            expect(DOCUMENTATION_CATEGORIES as readonly string[]).toContain(doc.category);
        }
    });

    it("summarises every command upstream describes, and only those lack one", () => {
        // These seven pages go straight from the heading to `## Syntax`, and their
        // `## Detailed Description` section is empty too — the description is missing
        // upstream, not lost by the indexer. Pinned as a list so a *new* empty summary
        // fails here instead of quietly degrading the index.
        const undocumentedUpstream = [
            "Get-ItemCloneNotification",
            "Initialize-SearchIndexItem",
            "Invoke-JavaScript",
            "Receive-ItemCloneNotification",
            "Remove-SearchIndexItem",
            "Test-BaseTemplate",
            "Update-SearchIndexItem",
        ];

        const empty = commandIndex()
            .filter((doc) => doc.summary.trim() === "")
            .map((doc) => doc.name)
            .sort();
        expect(empty).toEqual(undocumentedUpstream);

        for (const doc of commandIndex()) {
            if (undocumentedUpstream.includes(doc.name)) continue;
            expect(doc.summary.length, `${doc.name} has no usable summary`).toBeGreaterThan(5);
        }
    });

    it("never mistakes the copyright footer for a summary", () => {
        for (const doc of commandIndex()) {
            expect(doc.summary).not.toMatch(/All rights reserved/i);
            expect(doc.summary).not.toMatch(/Najmanowicz/i);
        }
    });

    it("has no duplicate command names", () => {
        const names = commandIndex().map((doc) => doc.name);
        expect(new Set(names).size).toBe(names.length);
    });

    it("populates every category", () => {
        for (const category of DOCUMENTATION_CATEGORIES) {
            const inCategory = commandIndex().filter((doc) => doc.category === category);
            expect(inCategory.length).toBeGreaterThan(0);
        }
    });

    it("caches the index rather than rescanning per call", () => {
        const first = commandIndex();
        expect(commandIndex()).toBe(first);
        resetCommandIndex();
        expect(commandIndex()).not.toBe(first);
    });

    it("indexes the commands the typed tools wrap", () => {
        // Each of these is the cmdlet behind a tool in this server, so a gap here means an
        // agent cannot look up the parameters of something it is being asked to call.
        for (const name of [
            "Get-Item", "Get-ItemTemplate", "Add-Rendering", "Get-Rendering",
            "Set-Layout", "Find-Item", "Publish-Item", "New-User", "Get-ItemAcl",
            "Add-PlaceholderSetting", "Invoke-Workflow", "Get-SearchIndex",
        ]) {
            expect(findCommand(name), `${name} is missing from the index`).toBeDefined();
        }
    });
});

describe("findCommand", () => {
    it("matches case-insensitively, as PowerShell does", () => {
        for (const spelling of ["Get-ItemTemplate", "get-itemtemplate", "GET-ITEMTEMPLATE"]) {
            expect(findCommand(spelling)?.name).toBe("Get-ItemTemplate");
        }
    });

    it("tolerates surrounding whitespace", () => {
        expect(findCommand("  Get-Item  ")?.name).toBe("Get-Item");
    });

    it("returns undefined for a name that does not exist", () => {
        expect(findCommand("Get-Nonsense")).toBeUndefined();
    });
});

describe("readCommandPage", () => {
    it("returns the full page, not the summary", () => {
        const doc = findCommand("Find-Item")!;
        const page = readCommandPage(doc);
        expect(page).toContain("# Find-Item");
        expect(page).toContain("## Syntax");
        expect(page).toContain("## Parameters");
    });

    it("carries the Find-Item parameters the stale copy was missing", () => {
        // The bundled page had drifted from upstream and documented neither -Path, -Template,
        // -Property nor -LatestVersion — all of which a search script commonly needs.
        const page = readCommandPage(findCommand("Find-Item")!);
        for (const parameter of ["-Path", "-Template", "-Property", "-LatestVersion"]) {
            expect(page, `Find-Item should document ${parameter}`).toContain(`### ${parameter}`);
        }
    });
});

describe("suggestCommands", () => {
    it("puts the nearest name first for a plural typo", () => {
        // Get-ItemTemplates contains both Get-Item and Get-ItemTemplate; the longer one is
        // plainly what was meant.
        expect(suggestCommands("Get-ItemTemplates")[0]).toBe("Get-ItemTemplate");
    });

    it("suggests the right command for a wrong verb", () => {
        expect(suggestCommands("Fetch-ItemTemplate")).toContain("Get-ItemTemplate");
    });

    it("falls back to same-verb commands", () => {
        const suggestions = suggestCommands("Get-SomethingEntirelyMadeUp");
        expect(suggestions.length).toBeGreaterThan(0);
        expect(suggestions.every((name) => name.startsWith("Get-"))).toBe(true);
    });

    it("honours the limit", () => {
        expect(suggestCommands("Get-Item", 3).length).toBeLessThanOrEqual(3);
    });

    it("returns nothing for input that resembles no command", () => {
        expect(suggestCommands("zzzzqqqq")).toEqual([]);
    });
});

describe("progressive reveal keeps results small", () => {
    it("indexes the whole corpus far more cheaply than serving it", () => {
        const index = commandIndex();
        const indexSize = index
            .map((doc) => `- **${doc.name}** — ${doc.summary}`)
            .join("\n").length;
        const corpusSize = index
            .map((doc) => readCommandPage(doc).length)
            .reduce((a, b) => a + b, 0);

        // The old tool returned the whole corpus in one result. The index is what replaced
        // it as the entry point, and the ratio is the entire point of the change.
        expect(corpusSize).toBeGreaterThan(500_000);
        expect(indexSize).toBeLessThan(20_000);
        // Measured at ~581KB of pages against a ~13KB index: the entry point costs about
        // 2% of what returning everything did.
        expect(corpusSize / indexSize).toBeGreaterThan(30);
    });
});
