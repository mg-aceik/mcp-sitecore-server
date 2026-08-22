import { describe, it, expect } from "vitest";
import { callTool } from "@modelcontextprotocol/inspector/cli/build/client/tools.js";
import { client, transport } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("common-get-item-clone", async () => {
        // Arrange
        // /sitecore/content/Home/Tests/Common/Get-Item-Clone-By-Id
        const itemId = "{B1D6EFC6-8C72-4BA3-A00C-FFDF0F94AFE6}";
        const destinationPath = "/sitecore/content/Home/Tests/Common";
        const name = "Item Clone By Id Test";

        const newCloneArgs: Record<string, any> = {
            id: itemId,
            destination: destinationPath,
            name: name,
        };

        await callTool(client, "common-new-item-clone", newCloneArgs);

        const args: Record<string, any> = {
            id: itemId,
        };

        // Act
        const result = await callTool(client, "common-get-item-clone", args);

        // Assert
        const json = JSON.parse(result.content[0].text);
        const itemClone = json.Obj[0];

        expect(itemClone.Name).toBe(name);
        expect(itemClone.IsItemClone).toBeTruthy();

        // Cleanup
        const deleteItemArgs: Record<string, any> = {
            id: itemClone.ID.ToString,
        };

        await callTool(client, "item-service-delete-item", deleteItemArgs);
    });
});
