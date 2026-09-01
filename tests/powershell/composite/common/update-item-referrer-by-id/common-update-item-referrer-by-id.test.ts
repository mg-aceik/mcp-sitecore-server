import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../../client";
import { seedScratch, linkItems } from "../../../../fixtures";

await client.connect(transport);

// Source points at Old through its link field. The tool repoints every referrer of Old at
// New, so the fixture has to establish that link first -- nothing refers to a fresh item.
const scratch = await seedScratch(
    "update-item-referrer-by-id",
    ["Source", "Old", "New"],
    ["Title", "Text", { name: "Link", type: "Droptree" }],
);
await linkItems(scratch.item("Source"), scratch.item("Old"));
afterAll(() => scratch.cleanup());

describe("powershell", () => {
    it("common-update-item-referrer", async () => {
        // Act
        await callTool(client, "common-update-item-referrer", {
            id: scratch.item("Old").id,
            newTarget: scratch.item("New").path,
        });

        // Assert: Old has lost its referrer and New has gained it.
        const oldReferrers = await callTool(client, "common-get-item-referrer", { path: scratch.item("Old").path });
        const newReferrers = await callTool(client, "common-get-item-referrer", { path: scratch.item("New").path });

        expect(JSON.parse(oldReferrers.content[0].text).Obj).toBeUndefined();

        const referrers = JSON.parse(newReferrers.content[0].text).Obj;
        expect(referrers).toBeDefined();
        expect(referrers.map((referrer: any) => referrer.ItemPath)).toContain(scratch.item("Source").path);
    });
});
