import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../../client";
import { seedScratch, seedUser } from "../../../../fixtures";

await client.connect(transport);

const scratch = await seedScratch("test-item-acl-by-path", ["Target"]);
const user = await seedUser("acl-test");
afterAll(async () => {
    await scratch.cleanup();
    await user.remove();
});

const addressing = { path: scratch.item("Target").path };

describe("powershell", () => {
    it("security-test-item-acl", async () => {
        // A new user can read by default, so the interesting half is what happens after a
        // deny: the same call has to answer the other way.
        const allowed = await callTool(client, "security-test-item-acl", {
            ...addressing,
            identity: user.name,
            accessRight: "item:read",
        });
        expect(JSON.parse(allowed.content[0].text).Obj[0]).toBe(true);

        await callTool(client, "security-set-item-acl", {
            ...addressing,
            action: "add",
            identity: user.name,
            accessRight: "item:read",
            propagationType: "Entity",
            securityPermission: "DenyAccess",
        });

        const denied = await callTool(client, "security-test-item-acl", {
            ...addressing,
            identity: user.name,
            accessRight: "item:read",
        });
        expect(JSON.parse(denied.content[0].text).Obj[0]).toBe(false);
    });
});
