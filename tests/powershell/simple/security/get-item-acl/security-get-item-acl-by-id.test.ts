import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../../client";
import { seedScratch, seedRole } from "../../../../fixtures";

await client.connect(transport);

const scratch = await seedScratch("get-item-acl-by-id", ["Target"]);
const role = await seedRole("acl-get");
afterAll(async () => {
    await scratch.cleanup();
    await role.remove();
});

const addressing = { id: scratch.item("Target").id };

describe("powershell", () => {
    it("security-get-item-acl", async () => {
        // Arrange: a rule to read back. A freshly created item carries none of its own.
        await callTool(client, "security-set-item-acl", {
            ...addressing,
            action: "add",
            identity: role.name,
            accessRight: "item:read",
            propagationType: "Entity",
            securityPermission: "AllowAccess",
        });

        // Act
        const result = await callTool(client, "security-get-item-acl", addressing);

        // Assert -- the projected access rule, not the .NET graph behind it.
        const rule = JSON.parse(result.content[0].text).Obj
            .find((entry: any) => entry.Account === role.name);

        expect(rule).toBeDefined();
        expect(rule.AccountType).toBe("Role");
        expect(rule.AccessRight).toBe("item:read");
        expect(rule.PropagationType).toBe("Entity");
        expect(rule.SecurityPermission).toBe("AllowAccess");
    });

    it("security-get-item-acl narrows to one account", async () => {
        const result = await callTool(client, "security-get-item-acl", { ...addressing, identity: role.name });
        const returned = JSON.parse(result.content[0].text).Obj ?? [];

        expect(returned.length).toBeGreaterThan(0);
        expect(returned.every((entry: any) => entry.Account === role.name)).toBe(true);
    });
});
