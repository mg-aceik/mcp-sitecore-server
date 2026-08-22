import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../client";

/**
 * Live verification of the final-layout fixes and the new security serialization
 * tools, against the CM configured in .env. Unlike the other suites this one
 * provisions its own page (the shared test tree's shared layouts mask the
 * final-layout-only shape these bugs need), and removes it afterwards.
 */

await client.connect(transport);

const TEMP_PATH = "master:/sitecore/content/Stride/Corporate/Home/MCP Live Test Temp";
const PAGE_TEMPLATE = "{59BCF94A-E9AA-4B13-AAE3-A745503FA421}";
const RICHTEXT = "{AD10DB7C-C944-42D9-9563-1F1070CC922E}";
const HEADING = "{AAADD1BD-43D2-4F9A-9817-CAC2E7931A98}";

const GUID = /\{[0-9A-F-]{36}\}/i;

async function run(script: string): Promise<void> {
    await callTool(client, "run-powershell-script", { script });
}

function text(result: { content: Array<Record<string, any>> }): string {
    return result.content.map((block) => block.text ?? "").join("\n");
}

afterAll(async () => {
    await run(`$i = Get-Item "${TEMP_PATH}" -ErrorAction SilentlyContinue; if ($i) { $i | Remove-Item -Recurse -Force }`);
});

describe("final-layout fixes and security serialization (live)", () => {
    it("set/switch/get default to the final layout and switch reports the new uniqueId", async () => {
        // Arrange: a page whose renderings exist ONLY in the final layout.
        await run(`
            $existing = Get-Item "${TEMP_PATH}" -ErrorAction SilentlyContinue
            if ($existing) { $existing | Remove-Item -Recurse -Force }
            New-Item -Path "${TEMP_PATH}" -ItemType "${PAGE_TEMPLATE}" | Out-Null
        `);
        for (const renderingId of [RICHTEXT, HEADING]) {
            const added = await callTool(client, "presentation-add-rendering", {
                path: TEMP_PATH, renderingId, placeHolder: "headless-main", database: "master", finalLayout: true,
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
            path: TEMP_PATH, uniqueId, newRenderingId: HEADING,
        });
        expect(switched.isError ?? false).toBe(false);
        const switchedText = text(switched);
        expect(switchedText.toUpperCase()).toContain(HEADING.toUpperCase());
        const newUniqueId = switchedText.match(GUID)?.[0];
        expect(newUniqueId).toBeTruthy();
        expect(newUniqueId!.toUpperCase()).not.toBe(uniqueId.toUpperCase());

        // A bogus uniqueId errors instead of silently no-opping. SPE 8 throws its own
        // "Cannot find a rendering to remove"; the tool's empty-diff guard ("changed
        // nothing") is the backstop for SPE paths that no-op instead.
        const bogus = await callTool(client, "presentation-switch-rendering", {
            path: TEMP_PATH, uniqueId: "{00000000-0000-0000-0000-00000000DEAD}", newRenderingId: RICHTEXT,
        });
        expect(bogus.isError).toBe(true);
        expect(text(bogus)).toMatch(/changed nothing|Cannot find a rendering/);
    });

    it("security export/import round-trips users and roles", async () => {
        const exportedUser = await callTool(client, "security-export-user", { identity: "sitecore\\admin" });
        expect(exportedUser.isError ?? false).toBe(false);
        expect(text(exportedUser)).toMatch(/admin\.user/i);
        const importedUser = await callTool(client, "security-import-user", { identity: "sitecore\\admin" });
        expect(importedUser.isError ?? false).toBe(false);

        const exportedRole = await callTool(client, "security-export-role", { identity: "sitecore\\Author" });
        expect(exportedRole.isError ?? false).toBe(false);
        expect(text(exportedRole)).toMatch(/Author\.role/i);
        const importedRole = await callTool(client, "security-import-role", { identity: "sitecore\\Author" });
        expect(importedRole.isError ?? false).toBe(false);
    });
});
