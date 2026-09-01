import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../../client";
import { seedScratch } from "../../../../fixtures";

await client.connect(transport);

const scratch = await seedScratch("convert-from-item-clone-by-id", ["Source"]);
afterAll(() => scratch.cleanup());

describe("powershell", () => {
    it("common-convert-from-item-clone", async () => {
        // Arrange
        const name = "Clone To Convert";
        const created = await callTool(client, "common-new-item-clone", {
            id: scratch.item("Source").id,
            destination: scratch.root.path,
            name,
        });
        const itemClone = JSON.parse(created.content[0].text).Obj[0];

        // Act
        const result = await callTool(client, "common-convert-from-item-clone", {
            path: itemClone.ItemPath,
            passThru: true,
        });

        // Assert
        const item = JSON.parse(result.content[0].text).Obj[0];
        expect(item.Name).toBe(name);
        expect(item.IsItemClone).toBeFalsy();
    });
});
