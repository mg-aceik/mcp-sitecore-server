import { describe, it, expect } from "vitest";
import { callTool } from "@modelcontextprotocol/inspector/cli/build/client/tools.js";
import { client, transport } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("common-new-item-clone", async () => {
        // Arrange
        const itemPath = "/sitecore/content/Home/Tests/Common/Get-Item-Clone-By-Id";
        const destinationPath = "/sitecore/content/Home/Tests/Common";
        const name = "Item Clone By Path";

        const args: Record<string, any> = {
            path: itemPath,
            destination: destinationPath,
            name: name,
        };

        // Act
        const result = await callTool(client, "common-new-item-clone", args);

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
