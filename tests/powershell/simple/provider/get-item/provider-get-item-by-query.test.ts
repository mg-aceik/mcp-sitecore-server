import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../../client";
import { seedScratch } from "../../../../fixtures";

await client.connect(transport);

const scratch = await seedScratch("provider-get-item-by-query", ["Target"]);
afterAll(() => scratch.cleanup());

describe("powershell", () => {
    it("provider-get-item", async () => {
        // Sitecore query rather than a path. The scratch root's name carries hyphens, and a
        // query treats those as operators unless the segment is wrapped in #...#.
        const args: Record<string, any> = {
            query: `/sitecore/content/#${scratch.root.name}#//*[@@name='Target']`
        };

        const result = await callTool(client, "provider-get-item", args);
        const json = JSON.parse(result.content[0].text);

        // The projection returns identity, not the whole .NET graph, so ItemPath and ID are
        // what identify the item that came back.
        expect(json.Obj).toHaveLength(1);
        expect(json.Obj[0].ItemPath).toBe(scratch.item("Target").path);
        expect(json.Obj[0].ID.toLowerCase()).toBe(scratch.item("Target").id.toLowerCase());
    });
});
