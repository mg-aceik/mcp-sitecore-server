import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../../client";
import { seedScratch } from "../../../../fixtures";

await client.connect(transport);

// Deleting a seeded item is what puts an entry in the recycle bin for this test to read;
// the archive on a fresh CM is empty.
const scratch = await seedScratch("get-archive-item", ["Doomed"]);
afterAll(() => scratch.cleanup());

describe("powershell", () => {
    it("common-get-archive-item", async () => {
        // Arrange
        const itemId = scratch.item("Doomed").id;
        await callTool(client, "item-service-delete-item", { id: itemId });

        // Act
        const result = await callTool(client, "common-get-archive-item", {
            archive: "recyclebin",
            database: "master",
            itemId,
        });

        // Assert
        // The response is one paged summary object, not a bare row list: Items holds the
        // page, Total the size of the whole archive.
        const page = JSON.parse(result.content[0].text).Obj[0];

        expect(page.Total).toBeGreaterThan(0);
        expect(page.Returned).toBe(page.Items.length);
        expect(page.Items.map((entry: any) => entry.ItemId.toLowerCase())).toContain(itemId.toLowerCase());

        // Put it back, so the scratch cleanup can take it with the rest.
        await callTool(client, "common-restore-archive-item", {
            archive: "recyclebin",
            database: "master",
            itemId,
        });
    });
});
