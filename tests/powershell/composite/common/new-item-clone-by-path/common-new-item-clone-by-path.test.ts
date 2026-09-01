import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../../client";
import { seedScratch } from "../../../../fixtures";

await client.connect(transport);

const scratch = await seedScratch("new-item-clone-by-path", ["Source"]);
afterAll(() => scratch.cleanup());

describe("powershell", () => {
    it("common-new-item-clone", async () => {
        // Arrange
        const name = "Clone By Path";

        // Act
        const result = await callTool(client, "common-new-item-clone", {
            path: scratch.item("Source").path,
            destination: scratch.root.path,
            name,
        });

        // Assert
        const itemClone = JSON.parse(result.content[0].text).Obj[0];
        expect(itemClone.Name).toBe(name);
        expect(itemClone.ItemPath).toBe(`${scratch.root.path}/${name}`);
        expect(itemClone.TemplateID.toLowerCase()).toBe(scratch.template.id.toLowerCase());
    });
});
