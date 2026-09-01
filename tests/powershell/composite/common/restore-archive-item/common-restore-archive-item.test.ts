import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../../client";
import { seedScratch } from "../../../../fixtures";

await client.connect(transport);

const scratch = await seedScratch("restore-archive-item", ["Doomed"]);
afterAll(() => scratch.cleanup());

describe("powershell", () => {
    it("common-restore-archive-item", async () => {
        // Arrange
        const itemId = scratch.item("Doomed").id;
        await callTool(client, "item-service-delete-item", { id: itemId });

        // Get-Item reports a missing item as an error rather than an empty result, so this
        // reads isError instead of parsing a payload that is not JSON.
        const gone = await callTool(client, "provider-get-item", { id: itemId });
        expect(gone.isError).toBe(true);

        // Act
        await callTool(client, "common-restore-archive-item", {
            archive: "recyclebin",
            database: "master",
            itemId,
        });

        // Assert: back where it was, under the scratch root.
        const result = await callTool(client, "provider-get-item", { id: itemId });
        const item = JSON.parse(result.content[0].text).Obj[0];

        expect(item).toBeDefined();
        expect(item.ID.toLowerCase()).toBe(itemId.toLowerCase());
        expect(item.ItemPath).toBe(scratch.item("Doomed").path);
    });
});
