import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../../client";
import { seedScratch } from "../../../../fixtures";

await client.connect(transport);

const scratch = await seedScratch("protect-item-by-path", ["Target"]);
afterAll(() => scratch.cleanup());

const addressing = { path: scratch.item("Target").path };

describe("powershell", () => {
    it("security-set-item-protection", async () => {
        const result = await callTool(client, "security-set-item-protection", {
            ...addressing,
            action: "protect",
            passThru: true,
            fields: ["__Read Only"],
        });

        expect(JSON.parse(result.content[0].text).Obj[0]["__Read Only"]).toBe(1);

        // Unprotect again, or the scratch cleanup cannot delete it.
        await callTool(client, "security-set-item-protection", { ...addressing, action: "unprotect" });
    });
});
