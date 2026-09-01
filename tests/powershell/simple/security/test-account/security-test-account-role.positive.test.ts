import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../../client";
import { seedRole } from "../../../../fixtures";

await client.connect(transport);

const role = await seedRole("test-account-positive");
afterAll(() => role.remove());

describe("powershell", () => {
    it("security-test-account", async () => {
        const result = await callTool(client, "security-test-account", {
            identity: role.name,
            accountType: "Role",
        });

        expect(JSON.parse(result.content[0].text).Obj[0]).toBe(true);
    });
});
