import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../client";
import { seedScratch, seedPresentation, applyPresentation } from "../../../fixtures";

await client.connect(transport);

const scratch = await seedScratch("get-placeholder-setting-by-path", ["Page"]);
const presentation = await seedPresentation(scratch);
await applyPresentation(scratch.item("Page"), presentation);

const KEY = "test_placeholder";

// Arranged through the tool rather than the fixture: SPE's own Add-PlaceholderSetting is
// what presentation-add-placeholder-setting wraps, so there is no lower level to reach for.
await callTool(client, "presentation-add-placeholder-setting", {
    path: `master:${scratch.item("Page").path}`,
    placeholderSettingPath: `master:${presentation.placeholderSetting.path}`,
    key: KEY,
    finalLayout: true,
});

afterAll(() => scratch.cleanup());

const addressing = { path: `master:${scratch.item("Page").path}` };

describe("powershell", () => {
    it("presentation-get-placeholder-setting-using-key", async () => {
        const result = await callTool(client, "presentation-get-placeholder-setting", {
            ...addressing,
            key: KEY,
            finalLayout: true,
        });

        const objectToAssert = JSON.parse(result.content[0].text).Obj[0];
        expect(objectToAssert.Key).toBe(KEY);
        expect(objectToAssert.MetaDataItemId.toLowerCase()).toBe(presentation.placeholderSetting.id.toLowerCase());
    });

    it("presentation-get-placeholder-setting-using-uniqueid", async () => {
        const all = await callTool(client, "presentation-get-placeholder-setting", {
            ...addressing,
            finalLayout: true,
        });
        const uniqueId = JSON.parse(all.content[0].text).Obj[0].UniqueId;

        const result = await callTool(client, "presentation-get-placeholder-setting", {
            ...addressing,
            uniqueId,
            finalLayout: true,
        });

        const objectToAssert = JSON.parse(result.content[0].text).Obj[0];
        expect(objectToAssert.UniqueId.toLowerCase()).toBe(String(uniqueId).toLowerCase());
        expect(objectToAssert.Key).toBe(KEY);
    });
});
