import { describe, it, expect, afterAll } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeFile, rm } from "node:fs/promises";
import { client, transport, callTool } from "../client";

/**
 * Live verification of the Authoring and Management API tools against the CM configured
 * in .env. Requires AUTHORING_CLIENT_ID / AUTHORING_CLIENT_SECRET (or AUTHORING_TOKEN),
 * and `GraphQL.Enabled` on the CM.
 *
 * The write tests build their own fixtures under the Home item and delete them again, so
 * the suite is repeatable against a shared environment.
 */

await client.connect(transport);

function text(result: { content: Array<Record<string, any>> }): string {
    return result.content.map((block) => block.text ?? "").join("\n");
}

function json(result: { content: Array<Record<string, any>> }): any {
    return JSON.parse(text(result));
}

/** Fails with the endpoint's own message rather than a bare `false === true`. */
function expectOk(result: { isError?: boolean; content: Array<Record<string, any>> }): any {
    if (result.isError) {
        throw new Error(`Tool reported an error: ${text(result)}`);
    }
    return json(result);
}

const RUN = `mcp-authoring-live-${process.pid}`;
const SAMPLE_TEMPLATE = "{76036F5E-CBCE-46D1-AF0A-4143F9B557AA}";
const LOCAL_FILE = join(tmpdir(), `${RUN}.png`);

/** A 1x1 transparent PNG — enough for Sitecore to create a real Image media item. */
const PNG_BASE64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

/** Discovered in the first test and reused: the site root everything is created under. */
let homeItemId = "";
let createdItemId = "";
let createdTemplateId = "";

afterAll(async () => {
    // Clean up by ID where we have one, permanently so repeat runs do not collide in the
    // recycle bin. Failures here are not test failures -- the fixtures may never have been
    // created if an earlier test failed.
    for (const id of [createdItemId, createdTemplateId]) {
        if (!id) continue;
        try {
            await callTool(client, "authoring-delete-item", { id, permanently: true });
        } catch {
            // best effort
        }
    }
    // The media item is addressed by path, not by an id this file captured, so it needs its
    // own line -- without it every run leaves an image behind in the media library.
    try {
        await callTool(client, "authoring-delete-item", {
            path: `/sitecore/media library/${RUN}-media`,
            permanently: true,
        });
    } catch {
        // best effort
    }

    await rm(LOCAL_FILE, { force: true });
});

describe("authoring core (live)", () => {
    it("introspects the schema despite the endpoint's depth limit", async () => {
        // With no arguments the tool returns the operation index, one line per query and
        // mutation; the SDL itself is behind `full`.
        const index = await callTool(client, "authoring-introspect-schema", {});
        expect(index.isError ?? false).toBe(false);
        expect(text(index)).toContain("createItem");

        const result = await callTool(client, "authoring-introspect-schema", { full: true });
        expect(result.isError ?? false).toBe(false);
        const sdl = text(result);
        // graphql-js's own introspection query is rejected here for exceeding the maximum
        // execution depth of 13, so a non-trivial SDL is the proof the shallower one works.
        // The floor is deliberately low: how much SDL comes back depends on the tenant's
        // schema, and it is the shape below, not the size, that shows the query succeeded.
        expect(sdl.length).toBeGreaterThan(50_000);
        expect(sdl).toContain("type Mutation");
        expect(sdl).toContain("createItem(input: CreateItemInput!)");
    });

    it("runs an arbitrary document through authoring-graphql", async () => {
        const body = expectOk(await callTool(client, "authoring-graphql", {
            query: "query { publishingTargets { name } }",
        }));
        expect(Array.isArray(body.publishingTargets)).toBe(true);
    });

    it("reports a syntax error against the document, not the server", async () => {
        const result = await callTool(client, "authoring-graphql", {
            query: "query { this is not graphql",
        });
        expect(result.isError).toBe(true);
    });

    it("rejects a non-JSON variables string with an actionable message", async () => {
        const result = await callTool(client, "authoring-graphql", {
            query: "query { sites { name } }",
            variables: "not json",
        });
        expect(result.isError).toBe(true);
        expect(text(result)).toContain("JSON object string");
    });
});

describe("authoring sites (live)", () => {
    it("lists sites with their root item IDs", async () => {
        const body = expectOk(await callTool(client, "authoring-list-sites", {}));
        expect(Array.isArray(body.sites)).toBe(true);
        expect(body.sites.length).toBeGreaterThan(0);
        for (const site of body.sites) {
            expect(typeof site.name).toBe("string");
        }
    });

    it("hides system sites by default and shows them on request", async () => {
        const withoutSystem = expectOk(await callTool(client, "authoring-list-sites", {}));
        const withSystem = expectOk(await callTool(client, "authoring-list-sites", {
            includeSystemSites: true,
        }));
        expect(withSystem.sites.length).toBeGreaterThan(withoutSystem.sites.length);
        expect(withSystem.sites.map((s: any) => s.name)).toContain("shell");
    });

    it("reads one site by name", async () => {
        const list = expectOk(await callTool(client, "authoring-list-sites", {
            includeSystemSites: true,
        }));
        const name = list.sites[0].name;
        const body = expectOk(await callTool(client, "authoring-get-site", { siteName: name }));
        expect(body.site.name).toBe(name);
    });
});

describe("authoring items (live)", () => {
    it("reads the Home item by path and returns its fields", async () => {
        const body = expectOk(await callTool(client, "authoring-get-item", {
            path: "/sitecore/content",
        }));
        expect(body.item.path).toBe("/sitecore/content");
        expect(body.item.itemId).toBeTruthy();
        homeItemId = body.item.itemId;
    });

    it("reads the same item by ID", async () => {
        const body = expectOk(await callTool(client, "authoring-get-item", { id: homeItemId }));
        expect(body.item.path).toBe("/sitecore/content");
    });

    it("refuses a call that names neither id nor path", async () => {
        const result = await callTool(client, "authoring-get-item", {});
        expect(result.isError).toBe(true);
        expect(text(result)).toContain("exactly one");
    });

    it("refuses a call that names both id and path", async () => {
        const result = await callTool(client, "authoring-get-item", {
            id: homeItemId,
            path: "/sitecore/content",
        });
        expect(result.isError).toBe(true);
        expect(text(result)).toContain("exactly one");
    });

    it("creates an item with field values", async () => {
        const body = expectOk(await callTool(client, "authoring-create-item", {
            name: RUN,
            templateId: SAMPLE_TEMPLATE,
            parent: homeItemId,
            language: "en",
            fields: [{ name: "Title", value: "Created by the live suite" }],
        }));
        createdItemId = body.createItem.item.itemId;
        expect(createdItemId).toBeTruthy();
        expect(body.createItem.item.name).toBe(RUN);
    });

    it("updates a field on the created item", async () => {
        const body = expectOk(await callTool(client, "authoring-update-item", {
            id: createdItemId,
            language: "en",
            fields: [{ name: "Title", value: "Updated by the live suite" }],
        }));
        const fields = body.updateItem.item.fields.nodes;
        const title = fields.find((f: any) => f.name === "Title");
        expect(title.value).toBe("Updated by the live suite");
    });

    it("renames the created item", async () => {
        const body = expectOk(await callTool(client, "authoring-rename-item", {
            id: createdItemId,
            newName: `${RUN}-renamed`,
        }));
        expect(body.renameItem.item.name).toBe(`${RUN}-renamed`);
    });

    it("copies the item and then deletes the copy", async () => {
        const copy = expectOk(await callTool(client, "authoring-copy-item", {
            id: createdItemId,
            targetParentId: homeItemId,
            copyItemName: `${RUN}-copy`,
            deepCopy: false,
        }));
        const copyId = copy.copyItem.item.itemId;
        expect(copyId).toBeTruthy();
        expect(copyId).not.toBe(createdItemId);

        const deleted = expectOk(await callTool(client, "authoring-delete-item", {
            id: copyId,
            permanently: true,
        }));
        expect(deleted.deleteItem.successful).toBe(true);
    });
});

describe("authoring search (live)", () => {
    it("finds items by template name", async () => {
        const body = expectOk(await callTool(client, "authoring-search", {
            criteria: [{ field: "_templatename", value: "Sample Item", criteriaType: "EXACT", operator: "MUST" }],
            pageSize: 5,
        }));
        expect(typeof body.search.totalCount).toBe("number");
        expect(Array.isArray(body.search.results)).toBe(true);
    });

    it("honours pageSize", async () => {
        const body = expectOk(await callTool(client, "authoring-search", {
            criteria: [{ field: "_name", value: "*", criteriaType: "WILDCARD", operator: "MUST" }],
            pageSize: 3,
        }));
        expect(body.search.results.length).toBeLessThanOrEqual(3);
    });
});

describe("authoring templates (live)", () => {
    it("reads a known template, its sections and its fields", async () => {
        const body = expectOk(await callTool(client, "authoring-get-item-template", {
            templateId: SAMPLE_TEMPLATE,
        }));
        const template = body.itemTemplate;
        expect(template.templateId).toBeTruthy();
        expect(Array.isArray(template.sections.nodes)).toBe(true);
        // The Sample Item template carries Title and Text in a Data section.
        const fieldNames = template.ownFields.nodes.map((f: any) => f.name);
        expect(fieldNames).toContain("Title");
        // Each field reports the section it belongs to -- the grouping a section itself
        // cannot supply.
        for (const field of template.ownFields.nodes) {
            expect(field.section?.name).toBeTruthy();
        }
    });

    it("reads the same template by its template-relative path", async () => {
        const byId = expectOk(await callTool(client, "authoring-get-item-template", {
            templateId: SAMPLE_TEMPLATE,
        }));
        // The endpoint takes a path relative to /sitecore/templates with no leading slash,
        // which is exactly what `fullName` is. An absolute path is rejected.
        const byPath = expectOk(await callTool(client, "authoring-get-item-template", {
            path: byId.itemTemplate.fullName,
        }));
        expect(byPath.itemTemplate.templateId).toBe(byId.itemTemplate.templateId);
    });

    it("rejects an absolute template path, as the endpoint does", async () => {
        const result = await callTool(client, "authoring-get-item-template", {
            path: "/sitecore/templates/Sample/Sample Item",
        });
        expect(result.isError).toBe(true);
    });

    it("creates a template with a section and fields, then updates it", async () => {
        const templatesFolder = expectOk(await callTool(client, "authoring-get-item", {
            path: "/sitecore/templates/User Defined",
        }));

        const created = expectOk(await callTool(client, "authoring-create-item-template", {
            name: `${RUN}-template`,
            parent: templatesFolder.item.itemId,
            sections: [{
                name: "Live Suite",
                fields: [
                    { name: "Headline", type: "Single-Line Text" },
                    { name: "Body", type: "Rich Text" },
                ],
            }],
        }));
        createdTemplateId = created.createItemTemplate.itemTemplate.templateId;
        expect(createdTemplateId).toBeTruthy();

        const createdFields = created.createItemTemplate.itemTemplate.ownFields.nodes
            .map((f: any) => f.name);
        expect(createdFields).toContain("Headline");
        expect(createdFields).toContain("Body");

        // Adding to the existing section needs that section's ID: the endpoint matches
        // sections by ID, never by name, and a nameless repeat is rejected outright.
        const sectionId = created.createItemTemplate.itemTemplate.sections.nodes
            .find((s: any) => s.name === "Live Suite").itemTemplateSectionId;
        expect(sectionId).toBeTruthy();

        // An update without deleteMissingFields adds rather than replaces: naming only the
        // new field must leave Headline and Body in place.
        const updated = expectOk(await callTool(client, "authoring-update-item-template", {
            templateId: createdTemplateId,
            sections: [{
                templateSectionId: sectionId,
                name: "Live Suite",
                fields: [{ name: "Summary", type: "Multi-Line Text" }],
            }],
        }));
        const updatedFields = updated.updateItemTemplate.itemTemplate.ownFields.nodes
            .map((f: any) => f.name);
        expect(updatedFields).toContain("Summary");
        expect(updatedFields).toContain("Headline");
        expect(updatedFields).toContain("Body");
    });

    it("rejects re-adding a section by name without its ID", async () => {
        const result = await callTool(client, "authoring-update-item-template", {
            templateId: createdTemplateId,
            sections: [{ name: "Live Suite", fields: [{ name: "Ignored", type: "Single-Line Text" }] }],
        });
        expect(result.isError).toBe(true);
        expect(text(result)).toContain("already exists");
    });
});

describe("authoring management (live)", () => {
    it("lists jobs with a wildcard", async () => {
        const body = expectOk(await callTool(client, "authoring-list-jobs", {
            jobName: "*",
            first: 5,
        }));
        expect(Array.isArray(body.jobs.nodes)).toBe(true);
    });

    it("lists every job when no pattern is given", async () => {
        const body = expectOk(await callTool(client, "authoring-list-jobs", { first: 5 }));
        expect(Array.isArray(body.jobs.nodes)).toBe(true);
    });

    it("reports a publishing status for an unknown operation without crashing", async () => {
        const result = await callTool(client, "authoring-publishing-status", {
            publishingOperationId: "00000000-0000-0000-0000-000000000000;none",
        });
        // Either a null status or a reported error is acceptable; a thrown, unhandled
        // failure is not.
        expect(typeof text(result)).toBe("string");
    });

    it("refuses a publish that names neither root ids nor root paths", async () => {
        const result = await callTool(client, "authoring-publish-item", {
            languages: ["en"],
            targetDatabases: ["experienceedge"],
        });
        expect(result.isError).toBe(true);
        expect(text(result)).toContain("exactly one");
    });
});

describe("authoring media (live)", () => {
    it("uploads an image and reads the created media item back", async () => {
        // A PNG rather than a text file on purpose: Sitecore picks the media template from
        // the extension, and only an Image item has an Alt field for `alt` to land in.
        await writeFile(LOCAL_FILE, Buffer.from(PNG_BASE64, "base64"));

        const uploaded = expectOk(await callTool(client, "authoring-upload-media", {
            // No extension on the item path -- the endpoint rejects a '.' in an item name.
            itemPath: `${RUN}-media`,
            filePath: LOCAL_FILE,
            alt: "MCP authoring live test",
            overwriteExisting: true,
        }));
        expect(uploaded.uploadedBytes).toBeGreaterThan(0);
        // The pre-signed POST answers with the created item's own identity, which is what
        // makes this a media upload rather than a URL handed back to the caller.
        expect(JSON.stringify(uploaded.uploaded)).toMatch(/id|path|name/i);

        const read = expectOk(await callTool(client, "authoring-get-media-item", {
            path: `/sitecore/media library/${RUN}-media`,
        }));
        expect(read.mediaItem).toBeTruthy();
        expect(read.mediaItem.size).toBeGreaterThan(0);
        expect(read.mediaItem.alt).toBe("MCP authoring live test");
        expect(read.mediaItem.innerItem.name).toBeTruthy();

        // Clean up whatever the upload created, by path.
        const removed = expectOk(await callTool(client, "authoring-delete-item", {
            path: `/sitecore/media library/${RUN}-media`,
            permanently: true,
        }));
        expect(removed.deleteItem.successful).toBe(true);
    });

    it("refuses an upload that names no source", async () => {
        const result = await callTool(client, "authoring-upload-media", {
            itemPath: `${RUN}-nosource`,
        });
        expect(result.isError).toBe(true);
        expect(text(result)).toContain("exactly one");
    });
});
