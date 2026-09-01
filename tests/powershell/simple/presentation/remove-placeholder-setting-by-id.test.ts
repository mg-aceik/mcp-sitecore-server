import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../client";
import { seedScratch, seedPresentation, applyPresentation } from "../../../fixtures";

await client.connect(transport);

const scratch = await seedScratch("remove-placeholder-setting-by-id", ["Page"]);
const presentation = await seedPresentation(scratch);
await applyPresentation(scratch.item("Page"), presentation);
afterAll(() => scratch.cleanup());

const addressing = { id: scratch.item("Page").id };
const KEY = "test_placeholder";

describe("powershell", () => {
    it("presentation-remove-placeholder-setting", async () => {
        // Arrange
        await callTool(client, "presentation-add-placeholder-setting", {
            ...addressing,
            placeholderSettingPath: `master:${presentation.placeholderSetting.path}`,
            key: KEY,
            finalLayout: true,
        });

        const added = await callTool(client, "presentation-get-placeholder-setting", { ...addressing, finalLayout: true });
        const uniqueId = JSON.parse(added.content[0].text).Obj[0].UniqueId;

        // Act
        await callTool(client, "presentation-remove-placeholder-setting", {
            ...addressing,
            uniqueId,
            finalLayout: true,
        });

        // Assert
        const after = await callTool(client, "presentation-get-placeholder-setting", { ...addressing, finalLayout: true });
        const remaining = JSON.parse(after.content[0].text).Obj ?? [];
        expect(remaining.map((setting: any) => String(setting.UniqueId).toLowerCase()))
            .not.toContain(String(uniqueId).toLowerCase());
    });
});
