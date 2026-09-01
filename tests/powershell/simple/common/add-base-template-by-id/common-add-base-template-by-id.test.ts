import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../../client";
import { seedScratch, seedTemplate } from "../../../../fixtures";

await client.connect(transport);

// Base templates hang off a template, not an item, so the target here is the fixture
// template; the seeded item is what proves the change reached the items built from it.
const scratch = await seedScratch("add-base-template-by-id", ["Target"]);
const base = await seedTemplate(scratch, "Base", ["Subtitle"]);
afterAll(() => scratch.cleanup());

const derivesFromBase = async () => {
    const result = await callTool(client, "common-test-base-template", {
        path: scratch.item("Target").path,
        template: base.path,
    });
    return JSON.parse(result.content[0].text).Obj[0];
};

describe("powershell", () => {
    it("common-set-base-template", async () => {
        expect(await derivesFromBase()).toBe(false);

        // Act
        await callTool(client, "common-set-base-template", {
            action: "add",
            id: scratch.template.id,
            template: base.path,
        });

        // Assert
        expect(await derivesFromBase()).toBe(true);
    });
});
