import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../../client";
import { seedScratch, linkItems } from "../../../../fixtures";

await client.connect(transport);

const scratch = await seedScratch(
    "get-item-referrer-by-id",
    ["Target", "Source"],
    ["Title", "Text", { name: "Link", type: "Droptree" }],
);
await linkItems(scratch.item("Source"), scratch.item("Target"));
afterAll(() => scratch.cleanup());

describe("powershell", () => {
    it("common-get-item-referrer", async () => {
        const args: Record<string, any> = {
            id: scratch.item("Target").id
        };

        const result = await callTool(client, "common-get-item-referrer", args);
        const json = JSON.parse(result.content[0].text);

        expect(json.Obj.map((item: any) => item.Name)).toContain("Source");
    });
});
