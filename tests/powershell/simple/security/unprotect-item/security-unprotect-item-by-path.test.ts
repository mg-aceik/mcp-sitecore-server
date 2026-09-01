import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../../client";
import { seedScratch } from "../../../../fixtures";

await client.connect(transport);

const scratch = await seedScratch("unprotect-item-by-path", ["Target"]);
afterAll(() => scratch.cleanup());

const addressing = { path: scratch.item("Target").path };

describe("powershell", () => {
    it("security-set-item-protection unprotect", async () => {
        // Arrange: protection to remove.
        await callTool(client, "security-set-item-protection", { ...addressing, action: "protect" });

        const result = await callTool(client, "security-set-item-protection", {
            ...addressing,
            action: "unprotect",
            passThru: true,
            fields: ["__Read Only"],
        });

        expect(JSON.parse(result.content[0].text).Obj[0]["__Read Only"]).toBe("");
    });
});
