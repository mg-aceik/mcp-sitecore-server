import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../client";
import { seedScratch, seedPresentation } from "../../../fixtures";

/**
 * Live verification of the final-layout fixes and the security serialization tools against
 * the CM configured in .env.
 *
 * The page here carries renderings in its *final* layout and nothing in its shared one,
 * which is the shape these bugs need: the tools used to default their lookups to the shared
 * layout and so found nothing to act on.
 */

await client.connect(transport);

const scratch = await seedScratch("live-fixes", ["Page"]);
const presentation = await seedPresentation(scratch);
afterAll(() => scratch.cleanup());

const TEMP_PATH = `master:${scratch.item("Page").path}`;
const PLACEHOLDER = "headless-main";
const GUID = /\{[0-9A-F-]{36}\}/i;

function text(result: { content: Array<Record<string, any>> }): string {
    return result.content.map((block) => block.text ?? "").join("\n");
}

describe("final-layout fixes and security serialization (live)", () => {
    it("set/switch/get default to the final layout and switch reports the new uniqueId", async () => {
        // Arrange: a final layout and nothing in the shared one, then renderings into it.
        // A seeded item has no presentation at all until something puts it there.
        await callTool(client, "presentation-set-layout", {
            path: TEMP_PATH,
            layoutId: presentation.layout.id,
            finalLayout: true,
        });

        for (const rendering of [presentation.rendering, presentation.otherRendering]) {
            const added = await callTool(client, "presentation-add-rendering", {
                path: TEMP_PATH,
                renderingId: rendering.id,
                placeHolder: PLACEHOLDER,
                database: "master",
                finalLayout: true,
            });
            expect(added.isError ?? false).toBe(false);
        }

        // list-renderings (default final) sees them and yields a uniqueId to work with.
        const listed = text(await callTool(client, "presentation-list-renderings", { path: TEMP_PATH }));
        const uniqueIds = [...listed.matchAll(/"UniqueId":"(\{[0-9A-F-]+\})"/gi)].map((match) => match[1]);
        expect(uniqueIds.length).toBe(2);
        const uniqueId = uniqueIds[0];

        // get-rendering-parameter with finalLayout OMITTED: the old shared-layout default
        // made this fail with "No matching rendering was found".
        const parameters = await callTool(client, "presentation-get-rendering-parameter", {
            path: TEMP_PATH, renderingUniqueId: uniqueId,
        });
        expect(parameters.isError ?? false).toBe(false);
        expect(text(parameters)).not.toContain("No matching rendering");

        // set-rendering with finalLayout OMITTED: broken before even when finalLayout was
        // passed, because the lookup never sent -FinalLayout.
        const set = await callTool(client, "presentation-set-rendering", {
            path: TEMP_PATH, uniqueId, dataSource: "/sitecore/content", parameter: { livetest: "1" },
        });
        expect(set.isError ?? false).toBe(false);
        expect(text(set)).not.toContain("No matching rendering");
        const updated = text(await callTool(client, "presentation-get-rendering", { path: TEMP_PATH, uniqueId }));
        expect(updated).toContain("/sitecore/content");
        expect(updated).toContain("livetest=1");

        // switch-rendering by uniqueId returns the switched row carrying the NEW uniqueId.
        const switched = await callTool(client, "presentation-switch-rendering", {
            path: TEMP_PATH, uniqueId, newRenderingId: presentation.otherRendering.id,
        });
        expect(switched.isError ?? false).toBe(false);
        const switchedText = text(switched);
        expect(switchedText.toUpperCase()).toContain(presentation.otherRendering.id.toUpperCase());
        const newUniqueId = switchedText.match(GUID)?.[0];
        expect(newUniqueId).toBeTruthy();
        expect(newUniqueId!.toUpperCase()).not.toBe(uniqueId.toUpperCase());

        // A bogus uniqueId errors instead of silently no-opping. SPE 8 throws its own
        // "Cannot find a rendering to remove"; the tool's empty-diff guard ("changed
        // nothing") is the backstop for SPE paths that no-op instead.
        const bogus = await callTool(client, "presentation-switch-rendering", {
            path: TEMP_PATH,
            uniqueId: "{00000000-0000-0000-0000-00000000DEAD}",
            newRenderingId: presentation.rendering.id,
        });
        expect(bogus.isError).toBe(true);
        expect(text(bogus)).toMatch(/changed nothing|Cannot find a rendering/);
    });

    it("security export/import round-trips users and roles", async () => {
        const exportedUser = await callTool(client, "security-export-account", { accountType: "user", identity: "sitecore\\admin" });
        expect(exportedUser.isError ?? false).toBe(false);
        expect(text(exportedUser)).toMatch(/admin\.user/i);
        const importedUser = await callTool(client, "security-import-account", { accountType: "user", identity: "sitecore\\admin" });
        expect(importedUser.isError ?? false).toBe(false);

        const exportedRole = await callTool(client, "security-export-account", { accountType: "role", identity: "sitecore\\Author" });
        expect(exportedRole.isError ?? false).toBe(false);
        expect(text(exportedRole)).toMatch(/Author\.role/i);
        const importedRole = await callTool(client, "security-import-account", { accountType: "role", identity: "sitecore\\Author" });
        expect(importedRole.isError ?? false).toBe(false);
    });
});
