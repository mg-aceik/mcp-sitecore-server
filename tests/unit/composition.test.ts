import { describe, it, expect } from "vitest";
import {
    SITE_SCOPE_FUNCTIONS,
    itemLookupExpression,
    itemNotFoundMessage,
    missingSelectorMessage,
    selectorDatabase,
} from "../../src/tools/powershell/composite/composition/site-scope";
import { RENDERING_LOOKUP_FUNCTIONS, renderingLookupCall } from "../../src/tools/powershell/composite/composition/rendering-lookup";
import { PLACEHOLDER_SETTINGS_FUNCTIONS } from "../../src/tools/powershell/composite/composition/placeholder-settings";
import { RENDERING_PARAMETER_FUNCTIONS } from "../../src/tools/powershell/composite/composition/rendering-parameters";
import { SITE_READ_FUNCTIONS, siteResolutionScript } from "../../src/tools/powershell/composite/composition/site-reads";
import { quotePowerShellString } from "../../src/tools/powershell/command-builder";

describe("selectorDatabase", () => {
    it("defaults to master", () => {
        expect(selectorDatabase({})).toBe("master");
    });

    it("prefers a database prefix on the path over the database parameter", () => {
        expect(selectorDatabase({ path: "web:/sitecore/content/Home", database: "master" })).toBe("web");
    });

    it("uses the database parameter when the path carries no prefix", () => {
        expect(selectorDatabase({ path: "/sitecore/content/Home", database: "web" })).toBe("web");
    });
});

describe("itemLookupExpression", () => {
    it("returns undefined when neither a path nor an ID was supplied", () => {
        expect(itemLookupExpression({})).toBeUndefined();
        expect(itemLookupExpression({ database: "master", language: "en" })).toBeUndefined();
    });

    it("qualifies a bare path with the database", () => {
        expect(itemLookupExpression({ path: "/sitecore/content/Home" }))
            .toBe("Get-Item -Path 'master:/sitecore/content/Home' -ErrorAction SilentlyContinue");
    });

    it("leaves an already-qualified path alone", () => {
        expect(itemLookupExpression({ path: "web:/sitecore/content/Home" }))
            .toContain("'web:/sitecore/content/Home'");
    });

    it("looks up by ID against the database root", () => {
        expect(itemLookupExpression({ pageId: "{110D559F-DEA5-42EA-9C1C-8A5DF7E70EF9}" }))
            .toBe("Get-Item -Path 'master:' -ID '{110D559F-DEA5-42EA-9C1C-8A5DF7E70EF9}' -ErrorAction SilentlyContinue");
    });

    it("prefers the path when both are supplied, so one call cannot mean two items", () => {
        const expression = itemLookupExpression({ path: "/sitecore/content/Home", itemId: "{ABC}" })!;
        expect(expression).toContain("/sitecore/content/Home");
        expect(expression).not.toContain("{ABC}");
    });

    it("passes the language through", () => {
        expect(itemLookupExpression({ path: "/sitecore/content/Home", language: "da" }))
            .toContain(" -Language 'da'");
    });

    it("escapes a single quote in a path so it cannot break out of the literal", () => {
        expect(itemLookupExpression({ path: "/sitecore/content/it's'; Remove-Item /sitecore; '" }))
            .toContain("'master:/sitecore/content/it''s''; Remove-Item /sitecore; '''");
    });
});

describe("renderingLookupCall", () => {
    it("returns undefined when neither identifier was supplied", () => {
        expect(renderingLookupCall({})).toBeUndefined();
    });

    it("resolves a rendering path against the page's database variable", () => {
        expect(renderingLookupCall({ renderingPath: "/sitecore/layout/Renderings/Project/Stride/RichText" }))
            .toBe("Get-Item -Path ($database + ':' + '/sitecore/layout/Renderings/Project/Stride/RichText') -ErrorAction SilentlyContinue");
    });

    it("resolves a rendering ID against the page's database variable", () => {
        expect(renderingLookupCall({ renderingId: "{AD10DB7C-C944-42D9-9563-1F1070CC922E}" }))
            .toBe("Get-Item -Path ($database + ':') -ID '{AD10DB7C-C944-42D9-9563-1F1070CC922E}' -ErrorAction SilentlyContinue");
    });
});

describe("messages", () => {
    it("names the identifier parameter the caller should have supplied", () => {
        expect(missingSelectorMessage("pageId")).toContain("'pageId'");
    });

    it("says what to check when an item is not found", () => {
        expect(itemNotFoundMessage("page")).toContain("language");
    });
});

describe("siteResolutionScript", () => {
    it("resolves by name and fails naming the site when it is not registered", () => {
        const script = siteResolutionScript({ siteName: "Cova" }, quotePowerShellString);
        expect(script).toContain("Get-McpSiteInfoByName -SiteName 'Cova'");
        expect(script).toContain("list-sites");
    });

    it("resolves by item path via the site-root walk", () => {
        const script = siteResolutionScript({ path: "/sitecore/content/Stride/Cova/Home" }, quotePowerShellString);
        expect(script).toContain("Get-McpSiteRoot -Item $contextItem");
        expect(script).toContain("'master:/sitecore/content/Stride/Cova/Home'");
    });

    it("escapes a single quote in the site name", () => {
        const script = siteResolutionScript({ siteName: "it's" }, quotePowerShellString);
        expect(script).toContain("'it''s'");
    });
});

/**
 * The PowerShell libraries are strings assembled in TypeScript, so a stray backslash or a
 * missing definition is a runtime failure on the CM rather than a compile error. These
 * check the seams that have actually broken: the escaped character classes, and the
 * cross-file function dependencies (each library assumes the ones prepended before it).
 */
describe("PowerShell library text", () => {
    it("keeps the CR/LF character class escaped for PowerShell rather than for TypeScript", () => {
        expect(SITE_SCOPE_FUNCTIONS).toContain("-split '[|\\r\\n]'");
        expect(SITE_SCOPE_FUNCTIONS).not.toContain("-split '[|\n]'");
    });

    it("keeps the digit class escaped in the dynamic placeholder scan", () => {
        expect(RENDERING_PARAMETER_FUNCTIONS).toContain("DynamicPlaceholderId=(\\d+)");
        expect(RENDERING_PARAMETER_FUNCTIONS).toContain("'-(\\d+)(?=/|$)'");
    });

    it("defines every function the other libraries call", () => {
        const defined = new Set<string>();
        const called = new Set<string>();
        for (const library of [
            SITE_SCOPE_FUNCTIONS,
            PLACEHOLDER_SETTINGS_FUNCTIONS,
            RENDERING_LOOKUP_FUNCTIONS,
            RENDERING_PARAMETER_FUNCTIONS,
            SITE_READ_FUNCTIONS,
        ]) {
            for (const match of library.matchAll(/^function ([\w-]+) \{/gm)) {
                defined.add(match[1]);
            }
            // Call sites only: the `function X {` lines are stripped first, or every
            // definition would trivially count as its own caller.
            const body = library.replace(/^function [\w-]+ \{/gm, "{");
            for (const match of body.matchAll(/((?:Get|Set|Resolve|Test|Merge|New)-Mcp[\w-]+)/g)) {
                called.add(match[1]);
            }
        }
        expect(defined.size).toBeGreaterThan(10);
        expect(called.size).toBeGreaterThan(5);
        expect([...called].filter((name) => !defined.has(name))).toEqual([]);
    });

    it("avoids a local variable that shadows its own parameter", () => {
        // PowerShell variable names are case-insensitive, so `$name` inside a function
        // with a `$Name` parameter IS that parameter. Get-McpParameterValue was silently
        // returning the first parameter for every lookup because of exactly this.
        for (const library of [
            SITE_SCOPE_FUNCTIONS,
            PLACEHOLDER_SETTINGS_FUNCTIONS,
            RENDERING_LOOKUP_FUNCTIONS,
            RENDERING_PARAMETER_FUNCTIONS,
            SITE_READ_FUNCTIONS,
        ]) {
            for (const fn of library.split(/^function /m).slice(1)) {
                const parameters = [...(fn.match(/param\(([^)]*)\)/s)?.[1] ?? "").matchAll(/\$(\w+)/g)]
                    .map((match) => match[1].toLowerCase());
                const assigned = [...fn.matchAll(/^\s*\$(\w+) =/gm)].map((match) => match[1]);
                const shadowed = assigned.filter(
                    (name) => parameters.includes(name.toLowerCase()) && !parameters.includes(name)
                );
                expect(shadowed, `in function ${fn.split(" ")[0]}`).toEqual([]);
            }
        }
    });
});
