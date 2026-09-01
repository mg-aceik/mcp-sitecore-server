import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../../client";

await client.connect(transport);

const identity = `sitecore\\MCP-remove-role-${Date.now().toString(36)}`;

describe("powershell", () => {
    it("security-remove-role", async () => {
        // Arrange
        await callTool(client, "security-new-role", { identity });
        const before = await callTool(client, "security-get-role", { identity });
        expect(JSON.parse(before.content[0].text).Obj[0].Name).toBe(identity);

        // Act
        await callTool(client, "security-remove-role", { identity });

        // Assert
        const after = await callTool(client, "security-get-role", { identity });
        expect(after.isError).toBe(true);
    });
});
