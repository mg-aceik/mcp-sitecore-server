import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("security-test-account", async () => {
        // Test on the admin user which should exist in most Sitecore instances
        const args: Record<string, string> = {
            identity: "sitecore\\Developer does-not-exist",
            accountType: "Role"
        };
        
        // Test if the user exists
        const result = await callTool(client, "security-test-account", args);
        const json = JSON.parse(result.content[0].text);
        
        // Test-Account should return false for a non-existing user
        expect(json).toMatchObject({
            Obj: [false]
        });
    });
});