import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../../client";
import { seedScratch } from "../../../../fixtures";

await client.connect(transport);

const scratch = await seedScratch("remove-archive-item", ["Doomed"]);
afterAll(() => scratch.cleanup());

describe("powershell", () => {
    it("common-remove-archive-item", async () => {
        // Arrange: an entry in the recycle bin to purge.
        const itemId = scratch.item("Doomed").id;
        await callTool(client, "item-service-delete-item", { id: itemId });

        // Act
        await callTool(client, "common-remove-archive-item", {
            archive: "recyclebin",
            database: "master",
            itemId,
        });

        // Assert: purged from the archive, and so not restorable.
        const result = await callTool(client, "common-get-archive-item", {
            archive: "recyclebin",
            database: "master",
            itemId,
        });
        const page = JSON.parse(result.content[0].text).Obj[0];

        expect(page.Items.map((entry: any) => entry.ItemId.toLowerCase())).not.toContain(itemId.toLowerCase());
    });
});
