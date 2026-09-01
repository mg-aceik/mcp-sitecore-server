import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../../client";
import { seedScratch } from "../../../../fixtures";

await client.connect(transport);

const scratch = await seedScratch("get-item-template-by-path", ["Target"]);
afterAll(() => scratch.cleanup());

describe("powershell", () => {
    it("common-get-item-template", async () => {
        const args: Record<string, any> = {
            path: scratch.item("Target").path
        };

        const result = await callTool(client, "common-get-item-template", args);
        const json = JSON.parse(result.content[0].text);

        // The seeded item is built from the fixture template, so that is the template the
        // tool has to report back.
        expect(json).toBeDefined();
        expect(json.Obj[0].Name).toBe(scratch.template.name);
        expect(json.Obj[0].ID.toLowerCase()).toBe(scratch.template.id.toLowerCase());
        expect(json.Obj[0].ItemPath).toBe(scratch.template.path);
    });
});
