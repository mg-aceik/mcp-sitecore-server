import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("common-reset-item-field", async () => {
        // Arrange
        const itemPath = "/sitecore/content/Home/Tests/Common/Reset-Item-Field-By-Path";
        const itemId = "{C83A0F94-941F-40DE-8165-03C6EBFE4B17}";

        const args: Record<string, any> = {
            path: itemPath,
            name: ["Text"]
        };

        // Act
        await callTool(client, "common-reset-item-field", args);

        // Assert
        const getItemArgs: Record<string, any> = {
            path: itemPath,
        };

        const result = await callTool(client, "provider-get-item", getItemArgs);
        const json = JSON.parse(result.content[0].text);
        
        expect(json.Obj[0].Text).toBe("");

        // Cleanup
        const editItemArgs: Record<string, any> = {
            id: itemId,
            data: {
                Text: "Sample text"
            }
        };

        await callTool(client, "item-service-edit-item", editItemArgs);
    });
});
