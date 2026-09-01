import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../../client";
import { seedScratch, seedTemplate } from "../../../../fixtures";

await client.connect(transport);

// Two templates, so the test can move an item from one to the other and name both.
const scratch = await seedScratch("set-item-template-by-id", ["Target"]);
const replacement = await seedTemplate(scratch, "Replacement", ["Title"]);
afterAll(() => scratch.cleanup());

describe("powershell", () => {
    it("common-set-item-template", async () => {
        const target = scratch.item("Target").id;

        // Act
        await callTool(client, "common-set-item-template", { id: target, template: replacement.path });

        // Assert
        const result = await callTool(client, "common-get-item-template", { id: target });
        expect(JSON.parse(result.content[0].text).Obj[0].Name).toBe(replacement.name);

        // And back, which is the other half of the same tool.
        await callTool(client, "common-set-item-template", { id: target, template: scratch.template.path });
        const reverted = await callTool(client, "common-get-item-template", { id: target });
        expect(JSON.parse(reverted.content[0].text).Obj[0].Name).toBe(scratch.template.name);
    });
});
