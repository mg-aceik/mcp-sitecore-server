import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../../client";
import { seedUser, seedRole } from "../../../../fixtures";

await client.connect(transport);

const role = await seedRole("member-add");
const user = await seedUser("member-add");
afterAll(async () => {
    await user.remove();
    await role.remove();
});

describe("powershell", () => {
    it("security-add-role-member", async () => {
        // Act
        await callTool(client, "security-add-role-member", { identity: role.name, members: user.name });

        // Assert
        const result = await callTool(client, "security-get-role-member", { identity: role.name });
        const members = JSON.parse(result.content[0].text).Obj ?? [];

        expect(members.map((member: any) => member.Name)).toContain(user.name);
    });
});
