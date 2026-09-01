import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../../client";
import { seedScratch, assignWorkflow } from "../../../../fixtures";

await client.connect(transport);

const scratch = await seedScratch("get-item-reference-by-id", ["Target"]);
await assignWorkflow([scratch.item("Target")]);
afterAll(() => scratch.cleanup());

describe("powershell", () => {
    it("common-get-item-reference", async () => {
        const args: Record<string, any> = {
            id: scratch.item("Target").id
        };

        const result = await callTool(client, "common-get-item-reference", args);
        const json = JSON.parse(result.content[0].text);

        const names = json.Obj.map((item: any) => item.Name);
        expect(names).toEqual(expect.arrayContaining([
            scratch.template.name,
            "Draft",
            "Sample Workflow"
        ]));
    });
});
