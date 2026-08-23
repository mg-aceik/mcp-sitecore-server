import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("common-get-item-field", async () => {
        // Arrange
        // /sitecore/content/Home/Tests/Common/Get-Item-Field
        const itemId = "{429383EA-C741-41F8-BBBC-4DC0418E7B2C}";

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
