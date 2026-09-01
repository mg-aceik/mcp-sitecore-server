import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../../client";
import { seedScratch, linkItems } from "../../../../fixtures";

await client.connect(transport);

// Referrers point the other way to references: Source's link field holds Target's id, so
// Target's referrer is Source. Nothing refers to a freshly created item, so the link is
// part of the fixture rather than something the test can assume.
const scratch = await seedScratch(
    "get-item-referrer-by-path",
    ["Target", "Source"],
    ["Title", "Text", { name: "Link", type: "Droptree" }],
);
await linkItems(scratch.item("Source"), scratch.item("Target"));
afterAll(() => scratch.cleanup());

describe("powershell", () => {
    it("common-get-item-referrer", async () => {
        const args: Record<string, any> = {
            path: scratch.item("Target").path
        };

        const result = await callTool(client, "common-get-item-referrer", args);
        const json = JSON.parse(result.content[0].text);

        expect(json.Obj.map((item: any) => item.Name)).toContain("Source");
    });
});
