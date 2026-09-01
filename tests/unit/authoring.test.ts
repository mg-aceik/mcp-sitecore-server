import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { parse } from "graphql";
import { resolveAuthoringEndpoint, AUTHORING_GRAPHQL_PATH } from "../../src/config";
import { authoringIntrospectionQuery, TYPE_REF_DEPTH } from "../../src/tools/authoring/logic/introspection-query";
import {
    AuthoringAuthError,
    executeAuthoringGraphQL,
    getAuthoringToken,
    resetAuthoringTokenCache,
} from "../../src/tools/authoring/client";
import {
    AUTHORING_CONTENT_REGISTRARS,
    AUTHORING_CORE_REGISTRARS,
    AUTHORING_MANAGEMENT_REGISTRARS,
} from "../../src/tools/authoring/register-authoring";
import { TOOL_GROUPS } from "../../src/tool-profiles";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as items from "../../src/tools/authoring/tools/items";
import * as templates from "../../src/tools/authoring/tools/templates";
import * as media from "../../src/tools/authoring/tools/media";
import * as management from "../../src/tools/authoring/tools/management";

/**
 * Self-contained tests for the Authoring and Management plumbing: endpoint derivation,
 * the token lifecycle, and the error shaping that turns the endpoint's 200-with-errors
 * answers into something an agent can act on. The live suite in
 * tests/authoring/authoring-live.test.ts covers the operations themselves.
 */

/** A config carrying only what the authoring code reads. */
function conf(authoring: Partial<{
    endpoint: string;
    token: string;
    clientId: string;
    clientSecret: string;
    authority: string;
    audience: string;
}> = {}): any {
    return {
        authoring: {
            endpoint: "https://cm.example.com/sitecore/api/authoring/graphql/v1/",
            token: "",
            clientId: "",
            clientSecret: "",
            authority: "https://auth.sitecorecloud.io",
            audience: "https://api.sitecorecloud.io",
            ...authoring,
        },
    };
}

/**
 * A fetch mock that builds a *fresh* Response per call.
 *
 * `mockResolvedValue(new Response(...))` hands the same object to every call, and a
 * Response body can only be read once -- the second call fails with "Body is unusable"
 * rather than exercising the code under test.
 */
function mockFetch(build: () => Response) {
    return vi.spyOn(globalThis, "fetch").mockImplementation(async () => build());
}

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

describe("resolveAuthoringEndpoint", () => {
    it("derives the endpoint from the CM host when none is given", () => {
        expect(resolveAuthoringEndpoint(undefined, "https://cm.example.com"))
            .toBe(`https://cm.example.com${AUTHORING_GRAPHQL_PATH}`);
    });

    it("does not double the slash when the host URL has a trailing one", () => {
        expect(resolveAuthoringEndpoint(undefined, "https://cm.example.com/"))
            .toBe(`https://cm.example.com${AUTHORING_GRAPHQL_PATH}`);
        expect(resolveAuthoringEndpoint(undefined, "https://cm.example.com///"))
            .toBe(`https://cm.example.com${AUTHORING_GRAPHQL_PATH}`);
    });

    it("prefers an explicit endpoint, trimmed", () => {
        expect(resolveAuthoringEndpoint("  https://other/graphql/  ", "https://cm.example.com"))
            .toBe("https://other/graphql/");
    });

    it("treats a blank explicit endpoint as unset", () => {
        expect(resolveAuthoringEndpoint("   ", "https://cm.example.com"))
            .toBe(`https://cm.example.com${AUTHORING_GRAPHQL_PATH}`);
    });
});

describe("authoringIntrospectionQuery", () => {
    it("is a valid GraphQL document", () => {
        expect(() => parse(authoringIntrospectionQuery())).not.toThrow();
    });

    it("nests ofType shallowly enough for the endpoint's depth cap", () => {
        // graphql-js's own getIntrospectionQuery() uses nine levels, which the endpoint
        // rejects for exceeding a maximum execution depth of 13.
        const occurrences = authoringIntrospectionQuery().match(/ofType/g) ?? [];
        expect(occurrences.length).toBe(TYPE_REF_DEPTH);
        expect(TYPE_REF_DEPTH).toBeLessThan(9);
    });

    it("still asks for everything buildClientSchema needs", () => {
        const query = authoringIntrospectionQuery();
        for (const field of ["queryType", "mutationType", "types", "directives", "inputFields", "enumValues", "possibleTypes", "interfaces"]) {
            expect(query).toContain(field);
        }
    });
});

describe("getAuthoringToken", () => {
    beforeEach(() => {
        resetAuthoringTokenCache();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        resetAuthoringTokenCache();
    });

    it("uses a supplied token without contacting the authority", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch");
        await expect(getAuthoringToken(conf({ token: "  supplied  " }))).resolves.toBe("supplied");
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("names both ways to configure credentials when neither is set", async () => {
        await expect(getAuthoringToken(conf())).rejects.toThrow(AuthoringAuthError);
        await expect(getAuthoringToken(conf())).rejects.toThrow(/AUTHORING_CLIENT_ID/);
        await expect(getAuthoringToken(conf())).rejects.toThrow(/AUTHORING_TOKEN/);
    });

    it("requires both halves of the client-credentials pair", async () => {
        await expect(getAuthoringToken(conf({ clientId: "id" })))
            .rejects.toThrow(AuthoringAuthError);
        await expect(getAuthoringToken(conf({ clientSecret: "secret" })))
            .rejects.toThrow(AuthoringAuthError);
    });

    it("runs the client-credentials grant and caches the result", async () => {
        const fetchSpy = mockFetch(() =>
            jsonResponse({ access_token: "minted", expires_in: 3600, token_type: "Bearer" })
        );
        const config = conf({ clientId: "id", clientSecret: "secret" });

        await expect(getAuthoringToken(config)).resolves.toBe("minted");
        await expect(getAuthoringToken(config)).resolves.toBe("minted");
        expect(fetchSpy).toHaveBeenCalledTimes(1);

        const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
        expect(url).toBe("https://auth.sitecorecloud.io/oauth/token");
        expect(init.method).toBe("POST");
        const body = String(init.body);
        expect(body).toContain("grant_type=client_credentials");
        expect(body).toContain("audience=https%3A%2F%2Fapi.sitecorecloud.io");
        expect(body).toContain("client_id=id");
    });

    it("makes one token request for concurrent callers", async () => {
        const fetchSpy = mockFetch(() =>
            jsonResponse({ access_token: "minted", expires_in: 3600 })
        );
        const config = conf({ clientId: "id", clientSecret: "secret" });

        const tokens = await Promise.all([
            getAuthoringToken(config),
            getAuthoringToken(config),
            getAuthoringToken(config),
        ]);
        expect(tokens).toEqual(["minted", "minted", "minted"]);
        expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("mints a separate token per credential set", async () => {
        const fetchSpy = mockFetch(() =>
            jsonResponse({ access_token: "minted", expires_in: 3600 })
        );
        await getAuthoringToken(conf({ clientId: "a", clientSecret: "s" }));
        await getAuthoringToken(conf({ clientId: "b", clientSecret: "s" }));
        expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("does not reuse a token past its lifetime", async () => {
        mockFetch(() =>
            jsonResponse({ access_token: "minted", expires_in: 3600 })
        );
        const config = conf({ clientId: "id", clientSecret: "secret" });
        await getAuthoringToken(config);

        // Past the expiry, including the safety skew.
        vi.spyOn(Date, "now").mockReturnValue(Date.now() + 3600_000);
        await getAuthoringToken(config);
        expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });

    it("treats a missing expires_in as a short life rather than forever", async () => {
        mockFetch(() =>
            jsonResponse({ access_token: "minted" })
        );
        const config = conf({ clientId: "id", clientSecret: "secret" });
        await getAuthoringToken(config);

        vi.spyOn(Date, "now").mockReturnValue(Date.now() + 120_000);
        await getAuthoringToken(config);
        expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });

    it("surfaces the authority's own reason for a rejection", async () => {
        mockFetch(() =>
            new Response(JSON.stringify({ error: "access_denied", error_description: "Service not enabled" }), { status: 403 })
        );
        const config = conf({ clientId: "id", clientSecret: "secret" });
        await expect(getAuthoringToken(config)).rejects.toThrow(/access_denied/);
        await expect(getAuthoringToken(config)).rejects.toThrow(/AUTHORING_AUDIENCE/);
    });

    it("does not put the client secret in the error", async () => {
        mockFetch(() =>
            new Response("nope", { status: 401 })
        );
        const config = conf({ clientId: "id", clientSecret: "s3cr3t-value" });
        await expect(getAuthoringToken(config)).rejects.toThrow(
            expect.objectContaining({ message: expect.not.stringContaining("s3cr3t-value") }) as any
        );
    });

    it("fails clearly when the response carries no access_token", async () => {
        mockFetch(() => jsonResponse({ expires_in: 3600 }));
        await expect(getAuthoringToken(conf({ clientId: "id", clientSecret: "secret" })))
            .rejects.toThrow(/no 'access_token'/);
    });
});

describe("executeAuthoringGraphQL", () => {
    beforeEach(() => {
        resetAuthoringTokenCache();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        resetAuthoringTokenCache();
    });

    it("sends the bearer token and returns data", async () => {
        const fetchSpy = mockFetch(() =>
            jsonResponse({ data: { sites: [{ name: "website" }] } })
        );
        const data = await executeAuthoringGraphQL(
            conf({ token: "abc" }),
            "query { sites { name } }"
        );
        expect(data).toEqual({ sites: [{ name: "website" }] });

        const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
        expect((init.headers as Record<string, string>).Authorization).toBe("Bearer abc");
        expect(init.method).toBe("POST");
    });

    it("explains an unauthenticated 200 rather than reporting no data", async () => {
        // The endpoint answers an unauthorized call with HTTP 200 and this error code, so a
        // client that only checks response.ok would call it a successful empty result.
        mockFetch(() => jsonResponse({
            data: { sites: null },
            errors: [{
                message: "The current user is not authorized to access this resource.",
                extensions: { code: "AUTH_NOT_AUTHENTICATED" },
            }],
        }));
        await expect(executeAuthoringGraphQL(conf({ token: "abc" }), "query { sites { name } }"))
            .rejects.toThrow(/not authenticated/i);
    });

    it("points a 404 at the GraphQL.Enabled setting", async () => {
        mockFetch(() => new Response("Not Found", { status: 404 }));
        await expect(executeAuthoringGraphQL(conf({ token: "abc" }), "query { sites { name } }"))
            .rejects.toThrow(/GraphQL\.Enabled/);
    });

    it("points a 401 at the audience and environment access", async () => {
        mockFetch(() => new Response("Unauthorized", { status: 401 }));
        await expect(executeAuthoringGraphQL(conf({ token: "abc" }), "query { sites { name } }"))
            .rejects.toThrow(/audience/);
    });

    it("reports ordinary query errors without an auth hint", async () => {
        mockFetch(() => jsonResponse({
            errors: [{ message: "The field `nope` does not exist on the type `Item`." }],
        }));
        await expect(executeAuthoringGraphQL(conf({ token: "abc" }), "query { item { nope } }"))
            .rejects.toThrow(/does not exist/);
        await expect(executeAuthoringGraphQL(conf({ token: "abc" }), "query { item { nope } }"))
            .rejects.not.toThrow(/not authenticated/i);
    });

    it("fails clearly on a non-JSON body", async () => {
        mockFetch(() => new Response("<html>login</html>", { status: 200 }));
        await expect(executeAuthoringGraphQL(conf({ token: "abc" }), "query { sites { name } }"))
            .rejects.toThrow(/non-JSON body/);
    });
});

/**
 * The addressing sweep for the authoring tools, matching what merged-sweep.test.ts does
 * for the PowerShell and Item Service ones. Those are driven with the PowerShell layer
 * mocked; these go over HTTP, so `fetch` is what gets mocked here instead.
 *
 * merged-sweep.test.ts's completeness guard names these tools as covered by this block, so
 * a new authoring tool that validates an addressing input has to appear here.
 */
/** A real, tiny file for the media tool's filePath branch to read. */
const LOCAL_PROBE_FILE = join(tmpdir(), "mcp-authoring-unit-probe.bin");
writeFileSync(LOCAL_PROBE_FILE, Buffer.from([1, 2, 3, 4]));

describe("authoring addressing validation", () => {
    beforeEach(() => {
        resetAuthoringTokenCache();
        // Any successful answer will do: these tests are about which calls stop in
        // TypeScript before a request is made, and which get through.
        mockFetch(() => jsonResponse({ data: { ok: true } }));
    });

    afterEach(() => {
        vi.restoreAllMocks();
        resetAuthoringTokenCache();
    });

    /** Registers one tool against a stub server and hands back its name and handler. */
    function register(reg: (server: any, config: any) => void) {
        let name = "";
        let handler: any;
        reg({
            registerTool(toolName: string, _cfg: any, cb: any) {
                name = toolName;
                handler = cb;
                return {};
            },
        }, conf({ token: "test-token" }));
        return { name, call: (args: any) => handler(args) };
    }

    /**
     * Every authoring tool that validates addressing, with the alternatives it accepts.
     *
     * `extra` carries whatever else the tool requires, so a rejection can only be about
     * addressing. A tool validating two independent pairs appears once per pair, with the
     * other pair satisfied in `extra`.
     */
    const CASES: Array<{
        reg: (server: any, config: any) => void;
        alternatives: Array<Record<string, unknown>>;
        extra?: Record<string, unknown>;
    }> = [
        { reg: items.authoringGetItemTool, alternatives: [{ id: "{ID}" }, { path: "/sitecore/content" }] },
        {
            reg: items.authoringUpdateItemTool,
            alternatives: [{ id: "{ID}" }, { path: "/sitecore/content" }],
            extra: { fields: [{ name: "Title", value: "x" }] },
        },
        { reg: items.authoringDeleteItemTool, alternatives: [{ id: "{ID}" }, { path: "/sitecore/content" }] },
        {
            reg: items.authoringCopyItemTool,
            alternatives: [{ id: "{ID}" }, { path: "/sitecore/content" }],
            extra: { targetParentId: "{PARENT}" },
        },
        {
            reg: items.authoringCopyItemTool,
            alternatives: [{ targetParentId: "{PARENT}" }, { targetParentPath: "/sitecore/content" }],
            extra: { id: "{ID}" },
        },
        {
            reg: items.authoringMoveItemTool,
            alternatives: [{ id: "{ID}" }, { path: "/sitecore/content" }],
            extra: { targetParentId: "{PARENT}" },
        },
        {
            reg: items.authoringMoveItemTool,
            alternatives: [{ targetParentId: "{PARENT}" }, { targetParentPath: "/sitecore/content" }],
            extra: { id: "{ID}" },
        },
        {
            reg: items.authoringRenameItemTool,
            alternatives: [{ id: "{ID}" }, { path: "/sitecore/content" }],
            extra: { newName: "renamed" },
        },
        {
            reg: templates.authoringGetTemplateTool,
            alternatives: [{ templateId: "{ID}" }, { path: "Sample/Sample Item" }],
        },
        { reg: media.authoringGetMediaItemTool, alternatives: [{ id: "{ID}" }, { path: "/sitecore/media library/x" }] },
        {
            reg: media.authoringUploadMediaTool,
            // A real file on disk: the filePath branch reads the bytes before it would
            // reach the endpoint, so a made-up path fails for the wrong reason.
            alternatives: [{ content: "AAAA" }, { filePath: LOCAL_PROBE_FILE }],
            extra: { itemPath: "probe" },
        },
        {
            reg: management.authoringPublishItemTool,
            alternatives: [{ rootItemIds: ["{ID}"] }, { rootItemPaths: ["/sitecore/content"] }],
            extra: { languages: ["en"], targetDatabases: ["experienceedge"] },
        },
        {
            reg: management.authoringGetJobTool,
            alternatives: [{ jobName: "some-job" }, { handle: "some-handle" }],
        },
    ];

    it("covers every authoring tool that validates addressing", () => {
        // Anything using requireOneTarget must appear above, or nothing is checking it.
        const source = [
            readFileSync("src/tools/authoring/tools/items.ts", "utf8"),
            readFileSync("src/tools/authoring/tools/templates.ts", "utf8"),
            readFileSync("src/tools/authoring/tools/media.ts", "utf8"),
            readFileSync("src/tools/authoring/tools/sites.ts", "utf8"),
            readFileSync("src/tools/authoring/tools/search.ts", "utf8"),
            readFileSync("src/tools/authoring/tools/management.ts", "utf8"),
        ].join("\n");

        // Tool names in files that call requireOneTarget, taken per registerTool block.
        const validating = new Set<string>();
        for (const block of source.split("server.registerTool(").slice(1)) {
            const name = /^\s*["']([a-z0-9-]+)["']/.exec(block)?.[1];
            if (name && block.includes("requireOneTarget(")) {
                validating.add(name);
            }
        }

        const covered = new Set(CASES.map(({ reg }) => register(reg).name));
        expect([...validating].filter((name) => !covered.has(name)).sort()).toEqual([]);
    });

    it.each(CASES.map((c, i) => [register(c.reg).name, i] as const))(
        "%s refuses zero and two addressing inputs and accepts one",
        async (_name, index) => {
            const { alternatives, extra = {}, reg } = CASES[index];
            const tool = register(reg);

            // Zero: nothing supplied, and nothing reaches the endpoint.
            const none = await tool.call({ ...extra });
            expect(none.isError).toBe(true);
            expect(globalThis.fetch).not.toHaveBeenCalled();

            // Two: ambiguous, and equally stopped before the request.
            const both = await tool.call({ ...extra, ...alternatives[0], ...alternatives[1] });
            expect(both.isError).toBe(true);
            expect(globalThis.fetch).not.toHaveBeenCalled();

            // One of each: gets past validation and reaches the endpoint.
            for (const alternative of alternatives) {
                (globalThis.fetch as any).mockClear();
                await tool.call({ ...extra, ...alternative });
                expect(globalThis.fetch).toHaveBeenCalled();
            }
        }
    );
});

describe("authoring tool groups", () => {
    it("are all registrable group names", () => {
        for (const group of ["authoring.core", "authoring.content", "authoring.management"]) {
            expect(TOOL_GROUPS as readonly string[]).toContain(group);
        }
    });

    it("register 22 tools in total", () => {
        const total = AUTHORING_CORE_REGISTRARS.length
            + AUTHORING_CONTENT_REGISTRARS.length
            + AUTHORING_MANAGEMENT_REGISTRARS.length;
        expect(AUTHORING_CORE_REGISTRARS.length).toBe(2);
        expect(AUTHORING_CONTENT_REGISTRARS.length).toBe(15);
        expect(AUTHORING_MANAGEMENT_REGISTRARS.length).toBe(5);
        expect(total).toBe(22);
    });

    it("register a distinct function per tool", () => {
        const all = [
            ...AUTHORING_CORE_REGISTRARS,
            ...AUTHORING_CONTENT_REGISTRARS,
            ...AUTHORING_MANAGEMENT_REGISTRARS,
        ];
        expect(new Set(all).size).toBe(all.length);
    });
});
