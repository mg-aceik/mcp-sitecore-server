import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../../client";
import { seedRole } from "../../../../fixtures";

await client.connect(transport);

const role = await seedRole("get-by-identity");
afterAll(() => role.remove());

describe("powershell", () => {
    it("security-get-role", async () => {
        const result = await callTool(client, "security-get-role", { identity: role.name });
        const returned = JSON.parse(result.content[0].text).Obj;

        expect(returned).toHaveLength(1);
        expect(returned[0].Name).toBe(role.name);
        expect(returned[0].AccountType).toBe("Role");
        // Roles carry these two and users do not, which is why they have their own projection.
        expect(returned[0].IsEveryone).toBe(false);
        expect(typeof returned[0].IsGlobal).toBe("boolean");
    });
});
