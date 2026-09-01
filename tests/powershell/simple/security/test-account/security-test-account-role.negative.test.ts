import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("security-test-account", async () => {
        const result = await callTool(client, "security-test-account", {
            identity: "sitecore\\MCP-no-such-role-at-all",
            accountType: "Role",
        });

        expect(JSON.parse(result.content[0].text).Obj[0]).toBe(false);
    });
});
