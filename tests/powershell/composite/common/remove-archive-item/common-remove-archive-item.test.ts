import { describe, it, expect } from "vitest";
import { callTool } from "@modelcontextprotocol/inspector/cli/build/client/tools.js";
import { client, transport } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("common-remove-archive-item", async () => {
        // Arrange
        const archive = "recyclebin";
        const database = "master";

        const itemPath = "/sitecore/content/Home/Tests/Common/Remove-Archive-Item";

        const getItemArgs: Record<string, any> = {
            path: itemPath,
        };

        const getItemResult = await callTool(client, "provider-get-item", getItemArgs);
        const itemToRemove = JSON.parse(getItemResult.content[0].text).Obj[0];

        const itemId = itemToRemove.Obj.ID.ToString;

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
        await callTool(client, "common-remove-archive-item", args);

        // Assert
        const getArchiveItem: Record<string, any> = {
            archive: archive,
            database: database,
            itemId: itemId,
        };

        const result = await callTool(client, "common-get-archive-item", getArchiveItem);
        const json = JSON.parse(result.content[0].text);
        const page = json.Obj[0];

        expect(page.Items.map((entry: any) => entry.ItemId)).not.toContain(itemId);

        // Cleanup
        const createItemArgs: Record<string, any> = {
            itemName: "Remove-Archive-Item",
            parentPath: "/sitecore/content/Home/Tests/Common",
            templateId: "{76036F5E-CBCE-46D1-AF0A-4143F9B557AA}",
        };

        await callTool(client, "item-service-create-item", createItemArgs);
    });
});
