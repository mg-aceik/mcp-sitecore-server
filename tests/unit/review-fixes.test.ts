import { afterEach, describe, expect, it, vi } from "vitest";
import {
    hasTarget,
    requireAtMostOneTarget,
    requireOneTarget,
} from "@/tools/target-input.js";
import {
    itemTargetDescription,
    itemTargetParameters,
} from "@/tools/powershell/composite/presentation/item-target.js";
import {
    itemLookupExpression,
    pathCarriesDatabase,
    requireOneSelector,
    selectorDatabase,
} from "@/tools/powershell/composite/composition/site-scope.js";
import {
    renderingLookupCall,
    requireOneRenderingSelector,
} from "@/tools/powershell/composite/composition/rendering-lookup.js";
import { xmlLooksLikeError } from "@/tools/powershell/error-shaping.js";
import { inferToolAnnotations } from "@/tool-annotations.js";
import {
    reportUnmatchedTools,
    resetUnmatchedToolReporting,
    resolveToolGating,
    withToolGating,
} from "@/tool-profiles.js";
import { redactConfig } from "@/config.js";
import { getLogsPowerShellTool } from "@/tools/powershell/composite/logging/get-logs.js";

afterEach(() => {
    vi.restoreAllMocks();
    resetUnmatchedToolReporting();
});

describe("target branching uses the same predicate as target validation", () => {
    // A whitespace-only id is not a target (validation trims), but it *is* truthy. Any
    // branch that tests truthiness therefore sends `-Id '  '` for a call the validator
    // accepted as addressing a path.
    const blankId = { id: "   ", path: "/sitecore/content/Home", database: "master" };

    it("treats a blank string as no target", () => {
        expect(hasTarget("   ")).toBe(false);
        expect(hasTarget("")).toBe(false);
        expect(hasTarget(undefined)).toBe(false);
        expect(hasTarget(null)).toBe(false);
        expect(hasTarget("x")).toBe(true);
        expect(hasTarget(0)).toBe(true);
        expect(hasTarget(false)).toBe(true);
    });

    it("accepts a blank id alongside a real path as exactly one target", () => {
        expect(requireOneTarget(blankId, ["id", "path"])).toBeUndefined();
    });

    it("addresses the path, not the blank id", () => {
        expect(itemTargetParameters(blankId)).toEqual({ Path: "/sitecore/content/Home" });
        expect(itemTargetDescription(blankId)).toContain("/sitecore/content/Home");
    });

    it("still addresses by id when an id was actually supplied", () => {
        const target = { id: "{11111111-1111-1111-1111-111111111111}", database: "web" };
        expect(itemTargetParameters(target)).toEqual({
            Id: "{11111111-1111-1111-1111-111111111111}",
            Database: "web",
        });
    });
});

describe("requireAtMostOneTarget", () => {
    it("permits neither, because the cmdlet has a documented default", () => {
        expect(requireAtMostOneTarget({}, ["root", "path"])).toBeUndefined();
    });

    it("permits exactly one", () => {
        expect(requireAtMostOneTarget({ root: "/data" }, ["root", "path"])).toBeUndefined();
    });

    it("rejects both, naming them", () => {
        const result = requireAtMostOneTarget({ root: "/data", path: "/data/a.user" }, ["root", "path"]);
        expect(result?.isError).toBe(true);
        expect((result?.content[0] as any).text).toContain("'root', 'path'");
    });
});

describe("composition selectors", () => {
    it("only reads a leading identifier as a database prefix", () => {
        expect(pathCarriesDatabase("master:/sitecore/content/Home")).toBe(true);
        expect(pathCarriesDatabase("/sitecore/content/Home/A:B")).toBe(false);
        expect(selectorDatabase({ path: "/sitecore/content/Home/A:B" })).toBe("master");
        expect(selectorDatabase({ path: "web:/sitecore/content/Home" })).toBe("web");
        expect(selectorDatabase({ path: "/sitecore/content/Home", database: "core" })).toBe("core");
    });

    it("prefixes a bare path with the selected database rather than leaving it drive-less", () => {
        expect(itemLookupExpression({ path: "/sitecore/content/Home/A:B", database: "web" }))
            .toContain("'web:/sitecore/content/Home/A:B'");
    });

    it("rejects a call that names both a path and a pageId", () => {
        const result = requireOneSelector(
            { path: "/sitecore/content/Home", pageId: "{11111111-1111-1111-1111-111111111111}" },
            "pageId"
        );
        expect(result?.isError).toBe(true);
        expect((result?.content[0] as any).text).toContain("one call cannot mean two items");
    });

    it("rejects a call that names both a renderingPath and a renderingId", () => {
        const result = requireOneRenderingSelector({
            renderingPath: "/sitecore/layout/Renderings/X",
            renderingId: "{22222222-2222-2222-2222-222222222222}",
        });
        expect(result?.isError).toBe(true);
    });

    it("accepts exactly one rendering selector", () => {
        expect(requireOneRenderingSelector({ renderingId: "{2222}" })).toBeUndefined();
        expect(renderingLookupCall({ renderingPath: "/sitecore/layout/Renderings/X" }))
            .toContain("($database + ':' + '/sitecore/layout/Renderings/X')");
    });

    it("does not mistake a colon inside a rendering path for a database prefix", () => {
        expect(renderingLookupCall({ renderingPath: "/sitecore/layout/Renderings/A:B" }))
            .toContain("($database + ':' + '/sitecore/layout/Renderings/A:B')");
    });
});

describe("xmlLooksLikeError", () => {
    it("flags an ErrorRecord and the error stream", () => {
        expect(xmlLooksLikeError('<S S="Error">boom</S>')).toBe(true);
        expect(xmlLooksLikeError('<S N="ErrorCategory_Message">x</S>')).toBe(true);
        expect(xmlLooksLikeError('<B N="writeErrorStream">true</B>')).toBe(true);
    });

    it("does not flag output that merely carries the flag set to false", () => {
        expect(xmlLooksLikeError('<B N="writeErrorStream">false</B>')).toBe(false);
    });

    it("does not flag content that merely contains the word Error", () => {
        expect(xmlLooksLikeError('<S>Error 404 page</S>')).toBe(false);
    });
});

describe("annotations that name inference gets wrong", () => {
    it("still infers the common cases from the tool name", () => {
        expect(inferToolAnnotations("common-get-item-field").readOnlyHint).toBe(true);
        expect(inferToolAnnotations("common-delete-item").destructiveHint).toBe(true);
        expect(inferToolAnnotations("security-import-user").readOnlyHint).toBe(false);
        expect(inferToolAnnotations("media-upload").readOnlyHint).toBe(false);
    });

    it("would call media-download read-only, which is why that tool declares its own", () => {
        // Documents the inference gap the explicit annotation in media-download.ts covers:
        // the tool does not mutate Sitecore, but saveTo writes to the local filesystem.
        expect(inferToolAnnotations("media-download").readOnlyHint).toBe(true);
    });
});

describe("tool gating", () => {
    it("ignores an allowlist made entirely of unknown names instead of registering nothing", () => {
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        const gating = resolveToolGating({ TOOL_GROUPS: "powershel.security,graphqll" } as any);
        expect(gating.enabledGroups).toBeNull();
    });

    it("drops the unknown names from a partly valid allowlist", () => {
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        const gating = resolveToolGating({ TOOL_GROUPS: "graphql,nope" } as any);
        expect([...gating.enabledGroups!]).toEqual(["graphql"]);
    });

    it("reports a DISABLED_TOOLS name that matched nothing", () => {
        const errors: string[] = [];
        vi.spyOn(console, "error").mockImplementation((m?: any) => { errors.push(String(m)); });
        const gating = resolveToolGating({ DISABLED_TOOLS: "media-upload,media-uplod" } as any);
        const server: any = { registerTool: (_n: string, _c: any, _cb: any) => ({ real: true }) };
        withToolGating(server, gating);
        server.registerTool("media-upload", {}, () => undefined);
        server.registerTool("media-download", {}, () => undefined);

        expect(reportUnmatchedTools(gating)).toEqual(["media-uplod"]);
        expect(errors.join("\n")).toContain("media-uplod");
    });

    it("hands back an inert handle rather than undefined for a denied tool", () => {
        const gating = resolveToolGating({ DISABLED_TOOLS: "media-upload" } as any);
        const server: any = { registerTool: () => ({ real: true }) };
        withToolGating(server, gating);
        const handle = server.registerTool("media-upload", {}, () => undefined);
        expect(handle).toBeDefined();
        expect(() => handle.disable()).not.toThrow();
        expect(() => handle.update({})).not.toThrow();
    });
});

describe("redactConfig", () => {
    const source: any = {
        name: "mcp",
        graphQL: { endpoint: "https://cm/graph", schemas: ["master"], apiKey: "key-123", headers: {} },
        itemService: { domain: "sitecore", username: "admin", password: "hunter2", serverUrl: "https://cm/" },
        powershell: { domain: "sitecore", username: "admin", password: "hunter2", serverUrl: "https://cm/" },
        authorizationHeader: "bearer-token",
    };

    it("masks every secret", () => {
        const redacted = redactConfig(source);
        const serialized = JSON.stringify(redacted);
        expect(serialized).not.toContain("hunter2");
        expect(serialized).not.toContain("key-123");
        expect(serialized).not.toContain("bearer-token");
    });

    it("keeps the non-secret configuration an agent needs", () => {
        const redacted = redactConfig(source);
        expect(redacted.powershell.serverUrl).toBe("https://cm/");
        expect(redacted.powershell.username).toBe("admin");
        expect(redacted.graphQL.schemas).toEqual(["master"]);
    });

    it("leaves an unset secret visibly unset rather than pretending one exists", () => {
        const redacted = redactConfig({ ...source, authorizationHeader: "" });
        expect(redacted.authorizationHeader).toBe("");
    });
});

describe("logging-get-logs date handling", () => {
    // Found live: formatDate threw *outside* safeMcpResponse, so a bad date escaped the
    // handler as an exception instead of coming back as a tool result.
    function register() {
        let handler: any;
        const server: any = {
            registerTool(_name: string, _cfg: any, cb: any) { handler = cb; return {}; },
        };
        getLogsPowerShellTool(server, { powershell: {} } as any);
        return handler;
    }

    it("returns an error result for an unparseable date rather than throwing", async () => {
        const handler = register();
        const result = await handler({ date: "not-a-date", name: "log", tail: 5, level: "DEBUG" }, {});
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("not a date this server can read");
        // Not wrapped in "Error executing tool:", which reads as a server fault.
        expect(result.content[0].text).not.toContain("Error executing tool");
    });
});

describe("media-upload read-back candidates", () => {
    // Found live: the SPE media handler names the item after the file name up to its
    // FIRST dot, so 'my.probe.png' is stored as an item called 'my'. The read-back used
    // LastIndexOf and looked for 'my.probe', which does not exist. Verified against a
    // live CM for 'plain.png', 'my.probe.png', 'v1.2 asset.jpg' and 'noextension'.
    it("derives the stem at the first dot and asks Sitecore to sanitise it", async () => {
        const { readFile } = await import("node:fs/promises");
        const source = await readFile("src/tools/powershell/media/media-upload.ts", "utf8");

        expect(source).toContain("$firstDot = $leaf.IndexOf('.')");
        expect(source).toContain("ProposeValidItemName");
        // The last-dot reading is kept as a fallback candidate, not as the only one.
        expect(source).toContain("$lastDot = $leaf.LastIndexOf('.')");
        // And the database is quoted rather than interpolated raw.
        expect(source).not.toContain("$database = '${params.database}'");
    });
});
