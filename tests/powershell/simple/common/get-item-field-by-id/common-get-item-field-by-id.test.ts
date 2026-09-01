import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../../client";
import { seedScratch } from "../../../../fixtures";

await client.connect(transport);

const scratch = await seedScratch("common-get-item-field-by-id", ["Get-Item-Field"]);
afterAll(() => scratch.cleanup());

describe("powershell", () => {
    it("common-get-item-field", async () => {
        // Arrange
        // /sitecore/content/Home/Tests/Common/Get-Item-Field
        const itemId = scratch.item("Get-Item-Field").id;

        const args: Record<string, any> = {
            id: itemId
        };

        // Act
        const result = await callTool(client, "common-get-item-field", args);
        
        // Assert
        const json = JSON.parse(result.content[0].text);

        expect(json).toBeDefined();
        expect(json.Obj).toEqual(expect.arrayContaining([
            "Text",
            "Title",
        ]));
    });
});
