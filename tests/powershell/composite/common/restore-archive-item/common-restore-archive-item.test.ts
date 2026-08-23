import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("common-restore-archive-item", async () => {
        // Arrange
        const archive = "recyclebin";
        const database = "master";

        // /sitecore/content/Home/Tests/Common/Restore-Archive-Item
        const itemId = "{2DA6F1F2-1584-4CF3-85EE-6EE27D9FB88F}";

        const deleteItemArgs: Record<string, any> = {
            id: itemId,
        };

        await callTool(client, "item-service-delete-item", deleteItemArgs);

        const args: Record<string, any> = {
            archive: archive,
            database: database,
            itemId: itemId,
        };

        // Act
        await callTool(client, "common-restore-archive-item", args);

        // Assert
        const getItemArgs: Record<string, any> = {
            id: itemId,
        };

        const getItemResult = await callTool(client, "provider-get-item", getItemArgs);
        const item = JSON.parse(getItemResult.content[0].text).Obj[0];

        expect(item).toBeDefined();
        expect(item.Obj.ID.ToString).toBe(itemId);
    });
});
