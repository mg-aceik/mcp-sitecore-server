import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../../client";
import { seedScratch, seedRole } from "../../../../fixtures";

await client.connect(transport);

// The rule names an account, so the test seeds one rather than assuming a role like
// `sitecore\\Developer` exists on this topology.
const scratch = await seedScratch("set-item-acl-by-id", ["Target"]);
const role = await seedRole("acl");
afterAll(async () => {
    await scratch.cleanup();
    await role.remove();
});

const addressing = { id: scratch.item("Target").id };
const RULE = {
    identity: role.name,
    accessRight: "item:write",
    propagationType: "Entity",
    securityPermission: "DenyAccess",
} as const;

const rules = async () => {
    const result = await callTool(client, "security-get-item-acl", { path: scratch.item("Target").path });
    return JSON.parse(result.content[0].text).Obj ?? [];
};

describe("powershell", () => {
    it("security-set-item-acl", async () => {
        // action 'replace' discards whatever was there and leaves only this rule.
        await callTool(client, "security-set-item-acl", { ...addressing, action: "replace", ...RULE });

        const current = await rules();
        expect(current.some((rule: any) =>
            rule.Account === RULE.identity &&
            rule.AccessRight === RULE.accessRight &&
            rule.PropagationType === RULE.propagationType &&
            rule.SecurityPermission === RULE.securityPermission
        )).toBe(true);

        // Clear takes them all off again.
        await callTool(client, "security-set-item-acl", { ...addressing, action: "clear" });
        expect(await rules()).toHaveLength(0);
    });
});
