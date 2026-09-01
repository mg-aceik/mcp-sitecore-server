import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../../client";

await client.connect(transport);

const identity = `sitecore\\MCP-remove-user-${Date.now().toString(36)}`;

describe("powershell", () => {
    it("security-remove-user", async () => {
        // Arrange
        await callTool(client, "security-new-user", { identity, password: "b", enabled: true });
        const before = await callTool(client, "security-get-user", { identity });
        expect(JSON.parse(before.content[0].text).Obj[0].Name).toBe(identity);

        // Act
        await callTool(client, "security-remove-user", { identity });

        // Assert: Get-User reports a missing account as an error rather than an empty result.
        const after = await callTool(client, "security-get-user", { identity });
        expect(after.isError).toBe(true);
    });
});
