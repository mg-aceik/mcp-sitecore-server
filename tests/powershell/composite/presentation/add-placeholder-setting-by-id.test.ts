import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../client";
import { seedScratch, seedPresentation, applyPresentation } from "../../../fixtures";

await client.connect(transport);

const scratch = await seedScratch("add-placeholder-setting-by-id", ["Page"]);
const presentation = await seedPresentation(scratch);
await applyPresentation(scratch.item("Page"), presentation);
afterAll(() => scratch.cleanup());

const addressing = { id: scratch.item("Page").id };
const KEY = "new_placeholder_setting";

describe("powershell", () => {
    it("presentation-add-placeholder-setting", async () => {
        // Act
        await callTool(client, "presentation-add-placeholder-setting", {
            ...addressing,
            placeholderSettingPath: `master:${presentation.placeholderSetting.path}`,
            key: KEY,
            finalLayout: true,
        });

        // Assert
        const result = await callTool(client, "presentation-get-placeholder-setting", { ...addressing, finalLayout: true });
        const objectToAssert = JSON.parse(result.content[0].text).Obj[0];

        expect(objectToAssert.Key).toBe(KEY);
        expect(objectToAssert.MetaDataItemId.toLowerCase()).toBe(presentation.placeholderSetting.id.toLowerCase());
    });
});
