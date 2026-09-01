import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../../client";
import { seedUser } from "../../../../fixtures";

await client.connect(transport);

// A user of this run's own, so the filter has something to match that is certainly there.
const user = await seedUser("get-by-filter");
afterAll(() => user.remove());

describe("powershell", () => {
    it("security-get-user", async () => {
        const result = await callTool(client, "security-get-user", { filter: `sitecore\\MCP-get-by-filter*` });
        const users = JSON.parse(result.content[0].text).Obj;

        expect(users.map((entry: any) => entry.Name)).toContain(user.name);
        for (const entry of users) {
            expect(entry.AccountType).toBe("User");
            expect(entry.Domain).toBe("sitecore");
        }
    });

    it("security-get-user requires exactly one of identity and filter", async () => {
        const both = await callTool(client, "security-get-user", { identity: user.name, filter: "sitecore\\*" });
        expect(both.isError).toBe(true);
    });
});
