import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../../client";
import { seedScratch } from "../../../../fixtures";

await client.connect(transport);

// The clone is created into the scratch root, so cleanup takes it with everything else.
const scratch = await seedScratch("get-item-clone-by-path", ["Source"]);
afterAll(() => scratch.cleanup());

describe("powershell", () => {
    it("common-get-item-clone", async () => {
        // Arrange
        const name = "Clone Of Source";
        await callTool(client, "common-new-item-clone", {
            path: scratch.item("Source").path,
            destination: scratch.root.path,
            name,
        });

        // Act
        const result = await callTool(client, "common-get-item-clone", { path: scratch.item("Source").path });

        // Assert
        const itemClone = JSON.parse(result.content[0].text).Obj[0];
        expect(itemClone.Name).toBe(name);
        expect(itemClone.ItemPath).toBe(`${scratch.root.path}/${name}`);
    });
});
