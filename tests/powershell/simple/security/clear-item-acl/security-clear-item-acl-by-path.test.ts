import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../../client";
import { seedScratch, seedRole } from "../../../../fixtures";

await client.connect(transport);

const scratch = await seedScratch("clear-item-acl-by-path", ["Target"]);
const role = await seedRole("acl-clear");
afterAll(async () => {
    await scratch.cleanup();
    await role.remove();
});

const addressing = { path: scratch.item("Target").path };

const rules = async () => {
    const result = await callTool(client, "security-get-item-acl", { path: scratch.item("Target").path });
    return JSON.parse(result.content[0].text).Obj ?? [];
};

describe("powershell", () => {
    it("security-set-item-acl clear", async () => {
        // Arrange: a rule to clear.
        await callTool(client, "security-set-item-acl", {
            ...addressing,
            action: "add",
            identity: role.name,
            accessRight: "item:write",
            propagationType: "Entity",
            securityPermission: "DenyAccess",
        });
        expect(await rules()).not.toHaveLength(0);

        // Act
        await callTool(client, "security-set-item-acl", { ...addressing, action: "clear" });

        // Assert
        expect(await rules()).toHaveLength(0);
    });

    it("security-set-item-acl rejects a clear that also names a rule", async () => {
        // A clear carrying an identity was most likely meant to be a replace.
        const result = await callTool(client, "security-set-item-acl", {
            ...addressing,
            action: "clear",
            identity: role.name,
            accessRight: "item:write",
        });

        expect(result.isError).toBe(true);
    });
});
