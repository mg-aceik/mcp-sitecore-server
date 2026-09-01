import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../../client";
import { seedUser, seedRole } from "../../../../fixtures";

await client.connect(transport);

const role = await seedRole("member-get");
const user = await seedUser("member-get");
afterAll(async () => {
    await user.remove();
    await role.remove();
});

describe("powershell", () => {
    it("security-get-role-member", async () => {
        // Arrange: a role with one known member.
        await callTool(client, "security-add-role-member", { identity: role.name, members: user.name });

        // Act
        const result = await callTool(client, "security-get-role-member", { identity: role.name });

        // Assert
        const members = JSON.parse(result.content[0].text).Obj;
        expect(members).toHaveLength(1);
        expect(members[0].Name).toBe(user.name);
        expect(members[0].AccountType).toBe("User");
    });
});
