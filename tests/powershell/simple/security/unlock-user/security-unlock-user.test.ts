import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../../client";
import { seedUser } from "../../../../fixtures";

await client.connect(transport);

const user = await seedUser("unlock");
afterAll(() => user.remove());

describe("powershell", () => {
    it("security-unlock-user", async () => {
        // A user can only be locked out by failed logins, and the login API is not reachable
        // over remoting, so there is no way to arrange a locked account here. What is worth
        // pinning is that the tool accepts an account that is not locked out rather than
        // failing on it.
        const result = await callTool(client, "security-unlock-user", { identity: user.name });

        expect(result.isError).not.toBe(true);
    });
});
