import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * `indexing-find-item` builds its PowerShell by hand and talks to `PowershellClient`
 * directly rather than going through `runGenericPowershellCommand`, so the client is what
 * gets mocked here and the built command is what gets asserted.
 *
 * The case that matters is two criteria on one field. `Select-Object` refuses a duplicate
 * property name with a *non-terminating* error raised once per result row -- "The property
 * cannot be processed because the property X already exists" -- and SPE serializes the
 * error stream into the same object graph as the results, where `findErrorRecord` picks it
 * up and the whole search is reported as a failure with every hit discarded. A range
 * written as GreaterThan plus LessThan on one date field is the ordinary way to ask that
 * question, so this was reachable from a completely reasonable call.
 */

const { executeScriptJson } = vi.hoisted(() => ({ executeScriptJson: vi.fn() }));

vi.mock("../../src/tools/powershell/client", () => ({
    PowershellClient: class {
        executeScriptJson = executeScriptJson;
    },
}));

import { findItemPowerShellTool } from "../../src/tools/powershell/simple/indexing/find-item";

const config = {
    powershell: {
        serverUrl: "https://cm.example.com/",
        username: "admin",
        password: "b",
        domain: "sitecore",
    },
} as any;

/** Registers the tool and returns its handler plus the schema it declared. */
async function register() {
    let handler: (params: any) => Promise<any> = async () => ({ content: [] });
    let schema: any;
    const server = {
        registerTool: (_name: string, definition: any, cb: (params: any) => Promise<any>) => {
            schema = definition.inputSchema;
            handler = cb;
        },
    } as any;
    await findItemPowerShellTool(server, config);
    return { handler, schema };
}

/** The command string the tool handed to the client on its single call. */
function builtCommand(): string {
    expect(executeScriptJson).toHaveBeenCalledTimes(1);
    return executeScriptJson.mock.calls[0][0] as string;
}

describe("indexing-find-item", () => {
    beforeEach(() => {
        executeScriptJson.mockReset();
        executeScriptJson.mockResolvedValue(JSON.stringify({
            Obj: [{ Skip: 0, First: 200, Returned: 0, HasMore: false, Items: [] }],
        }));
    });

    it("projects a repeated criterion field once, so Select-Object gets no duplicate", async () => {
        const { handler } = await register();
        await handler({
            index: "sitecore_master_index",
            criteria: [
                { filter: "GreaterThan", field: "__smallcreateddate_tdt", value: "2023-01-01T00:00:00Z" },
                { filter: "LessThan", field: "__smallcreateddate_tdt", value: "2023-12-31T23:59:59Z" },
            ],
            first: 200,
            skip: 0,
        });

        const command = builtCommand();
        const projections = [...command.matchAll(/n='__smallcreateddate_tdt'/g)];
        expect(projections).toHaveLength(1);
        // Both criteria still reach Find-Item -- deduping the projection must not drop a
        // filter, or the range silently becomes a half-open one.
        expect(command).toContain(`Filter = "GreaterThan"`);
        expect(command).toContain(`Filter = "LessThan"`);
    });

    it("matches the duplicate case-insensitively, as PowerShell property names do", async () => {
        const { handler } = await register();
        await handler({
            index: "sitecore_master_index",
            criteria: [
                { filter: "Contains", field: "title_t", value: "a" },
                { filter: "StartsWith", field: "Title_T", value: "b" },
            ],
            first: 200,
            skip: 0,
        });

        expect([...builtCommand().matchAll(/e=\{\$_\.Fields\[/g)]).toHaveLength(1);
    });

    it("does not re-project a field the fixed identity columns already carry", async () => {
        const { handler } = await register();
        await handler({
            index: "sitecore_master_index",
            criteria: [{ filter: "Equals", field: "TemplateName", value: "Sample Item" }],
            first: 200,
            skip: 0,
        });

        const command = builtCommand();
        // The fixed column survives, and no second single-quoted projection joins it.
        expect([...command.matchAll(/n="TemplateName"/g)]).toHaveLength(1);
        expect(command).not.toContain(`n='TemplateName'`);
    });

    it("still projects each distinct criterion field", async () => {
        const { handler } = await register();
        await handler({
            index: "sitecore_master_index",
            criteria: [
                { filter: "Contains", field: "title_t", value: "a" },
                { filter: "Contains", field: "body_t", value: "b" },
            ],
            first: 200,
            skip: 0,
        });

        const command = builtCommand();
        expect(command).toContain(`n='title_t'`);
        expect(command).toContain(`n='body_t'`);
    });

    it("caps 'first', which had no ceiling at all", async () => {
        const { schema } = await register();
        expect(schema.safeParse({
            criteria: [{ filter: "Equals", field: "_name", value: "Home" }],
            first: 100000,
        }).success).toBe(false);
        expect(schema.safeParse({
            criteria: [{ filter: "Equals", field: "_name", value: "Home" }],
            first: 500,
        }).success).toBe(true);
    });

    it("documents the piped range format on 'value', not only in a thrown error", async () => {
        const { schema } = await register();
        const value = schema.shape.criteria.element.shape.value;
        expect(value.description).toContain("start | end");
        expect(value.description).toContain("InclusiveRange");
    });

    // `Find-Item` wraps the Content Search API, which returns no total, so the tool used to
    // hand back a bare array: an agent could not tell a full page from the end of the
    // results. It now asks Sitecore for one row more than requested and reports HasMore.
    it("asks for one row more than requested, so HasMore needs no second query", async () => {
        const { handler } = await register();
        await handler({
            index: "sitecore_master_index",
            criteria: [{ filter: "Contains", field: "_name", value: "home" }],
            first: 10,
            skip: 5,
        });

        const command = builtCommand();
        expect(command).toContain("-First 11");
        expect(command).toContain("-Skip 5");
        // The extra row is trimmed before the caller sees it.
        expect(command).toContain("Select-Object -First 10");
        expect(command).toContain("HasMore = ($results.Count -gt 10)");
    });

    it("returns the envelope, with Items always a list", async () => {
        executeScriptJson.mockResolvedValue(JSON.stringify({
            Obj: [{
                Skip: 0,
                First: 2,
                Returned: 2,
                HasMore: true,
                Items: [{ Name: "Home" }, { Name: "About" }],
            }],
        }));

        const { handler } = await register();
        const result = await handler({
            index: "sitecore_master_index",
            criteria: [{ filter: "Contains", field: "_name", value: "o" }],
            first: 2,
            skip: 0,
        });

        const body = JSON.parse(result.content[0].text);
        expect(body.HasMore).toBe(true);
        expect(body.Returned).toBe(2);
        expect(body.Items).toHaveLength(2);
    });

    it("normalises a single result, which CLIXML delivers as a bare object", async () => {
        executeScriptJson.mockResolvedValue(JSON.stringify({
            Obj: [{ Skip: 0, First: 200, Returned: 1, HasMore: false, Items: { Name: "Home" } }],
        }));

        const { handler } = await register();
        const result = await handler({
            index: "sitecore_master_index",
            criteria: [{ filter: "Equals", field: "_name", value: "Home" }],
            first: 200,
            skip: 0,
        });

        const body = JSON.parse(result.content[0].text);
        expect(Array.isArray(body.Items)).toBe(true);
        expect(body.Items).toHaveLength(1);
        expect(body.Returned).toBe(1);
    });

    it("reports an empty search as an empty list rather than prose", async () => {
        const { handler } = await register();
        const result = await handler({
            index: "sitecore_master_index",
            criteria: [{ filter: "Equals", field: "_name", value: "nothing-matches" }],
            first: 200,
            skip: 0,
        });

        const body = JSON.parse(result.content[0].text);
        expect(body.Items).toEqual([]);
        expect(body.Returned).toBe(0);
        expect(body.HasMore).toBe(false);
    });
});
