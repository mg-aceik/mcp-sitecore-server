import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("common-convert-from-item-clone", async () => {
        // Arrange
        // /sitecore/content/Home/Tests/Common/Get-Item-Clone-By-Id
        const itemId = "{B1D6EFC6-8C72-4BA3-A00C-FFDF0F94AFE6}";
        const destinationPath = "/sitecore/content/Home/Tests/Common";
        const name = "Convert Item Clone By Id";

        const newCloneArgs: Record<string, any> = {
            id: itemId,
            destination: destinationPath,
            name: name,
        };

        const newCloneResult = await callTool(client, "common-new-item-clone", newCloneArgs);

        const itemClone = JSON.parse(newCloneResult.content[0].text).Obj[0];

        const args: Record<string, any> = {
            id: itemClone.ID.ToString,
            passThru: true,
        };

        // Act
        const result = await callTool(client, "common-convert-from-item-clone", args);

        // Assert
        const json = JSON.parse(result.content[0].text);
        const item = json.Obj[0];

        expect(item.Name).toBe(name);
        expect(item.IsItemClone).toBeFalsy();

        // Cleanup
        const deleteItemArgs: Record<string, any> = {
            id: itemClone.ID.ToString,
        };

        await callTool(client, "item-service-delete-item", deleteItemArgs);
    });
});
