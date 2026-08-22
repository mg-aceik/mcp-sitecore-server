import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("common-get-archive-item", async () => {
        // Arrange
        const archive = "recyclebin";
        const database = "master";

        // /sitecore/content/Home/Tests/Common/Get-Archive-Item
        const itemId = "{F2210E3A-770D-4F37-98C3-1767EBD22BA8}";

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
        const result = await callTool(client, "common-get-archive-item", args);

        // Assert
        // The response is one paged summary object, not a bare row list: Items holds the
        // page, Total the size of the whole archive.
        const json = JSON.parse(result.content[0].text);
        const page = json.Obj[0];

        expect(page.Total).toBeGreaterThan(0);
        expect(page.Returned).toBe(page.Items.length);
        expect(page.Items.map((entry: any) => entry.ItemId)).toContain(itemId);

        // Cleanup
        const restoreItemArgs: Record<string, any> = {
            archive: archive,
            database: database,
            itemId: itemId,
        };

        await callTool(client, "common-restore-archive-item", restoreItemArgs);
    });
});
