import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../../client";
import { seedRole } from "../../../../fixtures";

await client.connect(transport);

const role = await seedRole("get-by-filter");
afterAll(() => role.remove());

describe("powershell", () => {
    it("security-get-role", async () => {
        const result = await callTool(client, "security-get-role", { filter: `sitecore\\MCP-get-by-filter*` });
        const roles = JSON.parse(result.content[0].text).Obj;

        expect(roles.map((entry: any) => entry.Name)).toContain(role.name);
        for (const entry of roles) {
            expect(entry.AccountType).toBe("Role");
            expect(entry.Domain).toBe("sitecore");
        }
    });
});
