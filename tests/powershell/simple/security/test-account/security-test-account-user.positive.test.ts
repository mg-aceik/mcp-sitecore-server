import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../../client";
import { seedUser } from "../../../../fixtures";

await client.connect(transport);

const user = await seedUser("test-account-positive");
afterAll(() => user.remove());

describe("powershell", () => {
    it("security-test-account", async () => {
        const result = await callTool(client, "security-test-account", {
            identity: user.name,
            accountType: "User",
        });

        expect(JSON.parse(result.content[0].text).Obj[0]).toBe(true);
    });
});
