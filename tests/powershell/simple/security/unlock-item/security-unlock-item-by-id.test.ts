import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../../client";
import { seedScratch } from "../../../../fixtures";

await client.connect(transport);

const scratch = await seedScratch("unlock-item-by-id", ["Target"]);
afterAll(() => scratch.cleanup());

const addressing = { id: scratch.item("Target").id };

describe("powershell", () => {
    it("security-set-item-lock unlock", async () => {
        // Arrange: a lock to release.
        await callTool(client, "security-set-item-lock", { ...addressing, action: "lock" });

        const unlocked = await callTool(client, "security-set-item-lock", {
            ...addressing,
            action: "unlock",
            passThru: true,
            fields: ["__Lock"],
        });

        expect(JSON.parse(unlocked.content[0].text).Obj[0].__Lock).not.toContain("owner=");
    });

    it("security-set-item-lock rejects force on unlock", async () => {
        // SPE's Unlock-Item has no -Force, so the tool refuses it rather than letting the
        // whole call fail inside PowerShell.
        const result = await callTool(client, "security-set-item-lock", {
            ...addressing,
            action: "unlock",
            force: true,
        });

        expect(result.isError).toBe(true);
    });
});
