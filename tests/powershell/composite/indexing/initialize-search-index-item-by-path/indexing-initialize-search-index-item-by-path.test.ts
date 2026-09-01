import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../../client";
import { seedScratch } from "../../../../fixtures";

await client.connect(transport);

const INDEX = "sitecore_master_index";

const scratch = await seedScratch("rebuild-search-index-item-by-path", ["Target"]);
afterAll(() => scratch.cleanup());

describe("powershell", () => {
    it("indexing-rebuild-search-index scoped to one item", async () => {
        // Act: rebuild only the seeded item's subtree.
        const result = await callTool(client, "indexing-rebuild-search-index", {
            path: scratch.item("Target").path,
            name: INDEX,
        });
        expect(result.isError).not.toBe(true);

        // Assert: the item is findable in the index it was just written to. Indexing is
        // asynchronous, so this polls rather than reading once.
        const deadline = Date.now() + 30_000;
        let ids: string[] = [];
        while (Date.now() < deadline) {
            const found = await callTool(client, "indexing-find-item", {
                index: INDEX,
                criteria: [{ filter: "Equals", field: "_name", value: "Target" }],
                first: 20,
                skip: 0,
            });
            if (!found.isError) {
                const json = JSON.parse(found.content[0].text);
                ids = (json.Items ?? []).map((item: any) => String(item.ItemId).toLowerCase());
                if (ids.includes(scratch.item("Target").id.toLowerCase())) {
                    break;
                }
            }
            await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        expect(ids).toContain(scratch.item("Target").id.toLowerCase());
    }, 60_000);
});
