import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../../client";
import { seedScratch } from "../../../../fixtures";

await client.connect(transport);

const scratch = await seedScratch("lock-item-by-id", ["Target"]);
afterAll(() => scratch.cleanup());

const addressing = { id: scratch.item("Target").id };

describe("powershell", () => {
    it("security-set-item-lock", async () => {
        const locked = await callTool(client, "security-set-item-lock", {
            ...addressing,
            action: "lock",
            passThru: true,
            fields: ["__Lock"],
        });
        expect(JSON.parse(locked.content[0].text).Obj[0].__Lock).toContain("owner=");

        // Leave it as it was found.
        await callTool(client, "security-set-item-lock", { ...addressing, action: "unlock" });
    });
});
