import { describe, it, expect } from "vitest";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { getServer } from "../../src/server";
import type { Config } from "../../src/config";

/**
 * Every tool's advertised annotations, pinned by name.
 *
 * `inferToolAnnotations` is a denylist over an open vocabulary: a tool whose verb is in
 * neither token set falls through to `readOnlyHint: true`. That default is the dangerous
 * one -- a read-only tool is auto-permitted, so a mutation that lands in it runs with no
 * confirmation prompt. It has already happened once: `move`, `copy`, `rename` and
 * `rebuild` were in neither set, so `authoring-move-item`, `authoring-copy-item`,
 * `authoring-rename-item` and `authoring-rebuild-indexes` all advertised themselves as
 * reads.
 *
 * Unit-testing the inference function cannot catch that, because the bug is a name nobody
 * thought to test. So this asserts over the real `tools/list`, and the table has to be
 * exhaustive: a new tool fails here until someone classifies it deliberately, which is
 * the whole point.
 *
 * The three classes are the three shapes a client acts on:
 * - `read`        -- `readOnlyHint: true`, auto-permitted.
 * - `write`       -- modifies state, nothing is destroyed.
 * - `destructive` -- deletes, overwrites, or does something not safely reversible; the
 *                    host always prompts.
 */
type ToolClass = "read" | "write" | "destructive";

const EXPECTED: Record<string, ToolClass> = {
    "add-rendering-to-placeholder": "write",
    "authoring-copy-item": "write",
    "authoring-create-item": "write",
    "authoring-create-item-template": "write",
    "authoring-delete-item": "destructive",
    "authoring-get-item": "read",
    "authoring-get-item-template": "read",
    "authoring-get-job": "read",
    "authoring-get-media-item": "read",
    "authoring-get-site": "read",
    // Any document at all, syntax-checked only: a mutation goes through as readily as a
    // query, so the host has to prompt.
    "authoring-graphql": "destructive",
    "authoring-introspect-schema": "read",
    "authoring-list-jobs": "read",
    "authoring-list-sites": "read",
    "authoring-move-item": "write",
    "authoring-publish-item": "write",
    "authoring-publishing-status": "read",
    "authoring-rebuild-indexes": "write",
    "authoring-rename-item": "write",
    "authoring-search": "read",
    "authoring-update-item": "write",
    "authoring-update-item-template": "write",
    // Overwrites the blob of an existing media item when one is targeted.
    "authoring-upload-media": "destructive",
    "common-add-item-version": "write",
    "common-convert-from-item-clone": "write",
    "common-get-archive": "read",
    "common-get-archive-item": "read",
    "common-get-cache": "read",
    "common-get-database": "read",
    "common-get-item-clone": "read",
    "common-get-item-field": "read",
    "common-get-item-reference": "read",
    "common-get-item-referrer": "read",
    "common-get-item-template": "read",
    "common-get-item-workflow-event": "read",
    "common-get-sitecore-job": "read",
    "common-invoke-workflow": "write",
    "common-new-item-clone": "write",
    "common-new-item-workflow-event": "write",
    "common-publish-item": "write",
    "common-remove-archive-item": "destructive",
    "common-remove-item-version": "destructive",
    "common-reset-item-field": "destructive",
    "common-restart-application": "destructive",
    "common-restore-archive-item": "write",
    // action: "remove" takes the base template's fields off every item built from the
    // template, values included. One tool, so the annotation covers the worse action.
    "common-set-base-template": "destructive",
    "common-set-item-template": "write",
    "common-test-base-template": "read",
    "common-update-item-referrer": "write",
    "config": "read",
    "create-component-datasource": "write",
    "get-allowed-components-by-placeholder": "read",
    "get-pages-by-site": "read",
    "get-powershell-documentation": "read",
    "get-site-information": "read",
    "indexing-find-item": "read",
    "indexing-get-search-index": "read",
    "indexing-rebuild-search-index": "write",
    "indexing-set-search-index-state": "write",
    "introspection-graphql-edge": "read",
    "introspection-graphql-master": "read",
    "item-service-create-item": "write",
    "item-service-delete-item": "destructive",
    "item-service-edit-item": "write",
    "item-service-get-item": "read",
    "item-service-get-item-children": "read",
    "item-service-get-item-descendants": "read",
    "item-service-get-languages": "read",
    "item-service-search-items": "read",
    "list-insert-options": "read",
    "list-site-components": "read",
    "list-sites": "read",
    "logging-get-logs": "read",
    // Reads Sitecore, but `saveTo` writes a file on the machine running this server.
    "media-download": "write",
    "media-upload": "destructive",
    "presentation-add-placeholder-setting": "write",
    "presentation-add-rendering": "write",
    "presentation-get-layout": "read",
    "presentation-get-layout-device": "read",
    "presentation-get-placeholder-setting": "read",
    "presentation-get-rendering": "read",
    "presentation-get-rendering-parameter": "read",
    "presentation-list-renderings": "read",
    "presentation-merge-layout": "write",
    "presentation-remove-placeholder-setting": "destructive",
    "presentation-remove-rendering": "destructive",
    "presentation-remove-rendering-parameter": "destructive",
    "presentation-reset-layout": "destructive",
    "presentation-set-layout": "write",
    "presentation-set-rendering": "write",
    "presentation-set-rendering-parameter": "write",
    "presentation-switch-rendering": "write",
    "provider-get-item": "read",
    // Same reasoning as authoring-graphql: syntax-checked only, so a mutation passes.
    "query-graphql-edge": "destructive",
    "query-graphql-master": "destructive",
    "run-powershell-script": "destructive",
    "search-site-pages": "read",
    "security-add-role-member": "write",
    "security-disable-user": "destructive",
    "security-enable-user": "write",
    "security-export-account": "write",
    "security-get-current-user": "read",
    "security-get-domain": "read",
    "security-get-item-acl": "read",
    "security-get-role": "read",
    "security-get-role-member": "read",
    "security-get-user": "read",
    // Overwrites the live user or role with the serialized state.
    "security-import-account": "destructive",
    "security-new-domain": "write",
    "security-new-role": "write",
    "security-new-user": "write",
    "security-remove-domain": "destructive",
    "security-remove-role": "destructive",
    "security-remove-role-member": "destructive",
    "security-remove-user": "destructive",
    "security-set-item-acl": "destructive",
    "security-set-item-lock": "destructive",
    "security-set-item-protection": "destructive",
    "security-set-user": "write",
    "security-set-user-password": "write",
    "security-test-account": "read",
    "security-test-item-acl": "read",
    "security-unlock-user": "write",
};

/** A config complete enough to register every tool; nothing here is dialled. */
const config = {
    name: "@antonytm/mcp-sitecore-server 2.0.0",
    version: "2.0.0",
    graphQL: {
        endpoint: "https://cm.example.com/sitecore/api/graph/",
        schemas: ["edge", "master"],
        apiKey: "{00000000-0000-0000-0000-000000000000}",
        headers: {},
    },
    itemService: {
        domain: "sitecore",
        username: "admin",
        password: "b",
        serverUrl: "https://cm.example.com/",
    },
    powershell: {
        domain: "sitecore",
        username: "admin",
        password: "b",
        serverUrl: "https://cm.example.com/",
    },
    authoring: {
        endpoint: "https://cm.example.com/sitecore/api/authoring/graphql/v1/",
        token: "",
        clientId: "",
        clientSecret: "",
        authority: "https://auth.sitecorecloud.io",
        audience: "https://api.sitecorecloud.io",
    },
    authorizationHeader: "",
} satisfies Config;

type ListedTool = { name: string; annotations?: Record<string, unknown> };

async function listTools(): Promise<ListedTool[]> {
    const server = await getServer(config);
    const client = new Client({ name: "annotation-sweep", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    try {
        const { tools } = await client.listTools();
        return tools as ListedTool[];
    } finally {
        await client.close();
        await server.close();
    }
}

function classify(annotations: Record<string, unknown> | undefined): ToolClass {
    if (annotations?.readOnlyHint === true) {
        return "read";
    }
    return annotations?.destructiveHint === true ? "destructive" : "write";
}

describe("advertised tool annotations", () => {
    it("classifies every registered tool exactly as the table says", async () => {
        const tools = await listTools();
        const actual = Object.fromEntries(
            tools.map((tool) => [tool.name, classify(tool.annotations)])
        );
        // One assertion over the whole map rather than a loop, so a diff names every
        // tool that moved rather than stopping at the first.
        expect(actual).toEqual(EXPECTED);
    });

    it("leaves no tool unannotated", async () => {
        const tools = await listTools();
        const bare = tools.filter((tool) => tool.annotations === undefined).map((t) => t.name);
        expect(bare).toEqual([]);
    });

    it("never advertises a write or destructive tool as read-only", async () => {
        const tools = await listTools();
        const lying = tools
            .filter((tool) => tool.annotations?.readOnlyHint === true && EXPECTED[tool.name] !== "read")
            .map((tool) => tool.name);
        expect(lying).toEqual([]);
    });

    it("marks the any-document escape hatches destructive, not read-only", async () => {
        const tools = await listTools();
        const byName = new Map(tools.map((tool) => [tool.name, tool]));
        for (const name of ["authoring-graphql", "query-graphql-edge", "query-graphql-master", "run-powershell-script"]) {
            const annotations = byName.get(name)?.annotations;
            expect(annotations, `${name} is not registered`).toBeDefined();
            expect(annotations?.readOnlyHint, name).toBe(false);
            expect(annotations?.destructiveHint, name).toBe(true);
            expect(annotations?.openWorldHint, name).toBe(true);
        }
    });
});
