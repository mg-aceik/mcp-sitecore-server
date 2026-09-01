import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../../client";
import { seedScratch } from "../../../../fixtures";

await client.connect(transport);

// The fixture writes a value into every text field, so there is something to reset back to
// the template's (empty) standard value.
const scratch = await seedScratch("reset-item-field-by-id", ["Target"]);
afterAll(() => scratch.cleanup());

describe("powershell", () => {
    it("common-reset-item-field", async () => {
        // Arrange
        const target = scratch.item("Target").id;
        const before = await callTool(client, "provider-get-item", { id: target, fields: ["Text"] });
        expect(JSON.parse(before.content[0].text).Obj[0].Text).not.toBe("");

        // Act
        await callTool(client, "common-reset-item-field", { id: target, name: ["Text"] });

        // Assert
        const after = await callTool(client, "provider-get-item", { id: target, fields: ["Text"] });
        expect(JSON.parse(after.content[0].text).Obj[0].Text).toBe("");
    });
});
