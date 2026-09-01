import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../../client";
import { seedScratch, seedRole } from "../../../../fixtures";

await client.connect(transport);

// action 'add' appends a rule and leaves the others in place, which is what separates it
// from 'replace'.
const scratch = await seedScratch("add-item-acl-by-path", ["Target"]);
const roleOne = await seedRole("acl-one");
const roleTwo = await seedRole("acl-two");
afterAll(async () => {
    await scratch.cleanup();
    await roleOne.remove();
    await roleTwo.remove();
});

const addressing = { path: scratch.item("Target").path };

const accounts = async () => {
    const result = await callTool(client, "security-get-item-acl", { path: scratch.item("Target").path });
    return (JSON.parse(result.content[0].text).Obj ?? []).map((rule: any) => rule.Account);
};

describe("powershell", () => {
    it("security-set-item-acl add", async () => {
        await callTool(client, "security-set-item-acl", {
            ...addressing,
            action: "add",
            identity: roleOne.name,
            accessRight: "item:write",
            propagationType: "Entity",
            securityPermission: "DenyAccess",
        });

        await callTool(client, "security-set-item-acl", {
            ...addressing,
            action: "add",
            identity: roleTwo.name,
            accessRight: "item:read",
            propagationType: "Entity",
            securityPermission: "AllowAccess",
        });

        // Both survive: the second add did not discard the first.
        const current = await accounts();
        expect(current).toContain(roleOne.name);
        expect(current).toContain(roleTwo.name);
    });
});
