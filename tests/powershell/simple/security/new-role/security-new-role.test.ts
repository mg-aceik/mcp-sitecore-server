import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../../client";

await client.connect(transport);

const identity = `sitecore\\MCP-new-role-${Date.now().toString(36)}`;

describe("powershell", () => {
    it("security-new-role", async () => {
        // Act
        const created = await callTool(client, "security-new-role", { identity });
        expect(created.isError).not.toBe(true);

        // Assert
        const result = await callTool(client, "security-get-role", { identity });
        const role = JSON.parse(result.content[0].text).Obj[0];

        expect(role.Name).toBe(identity);
        expect(role.AccountType).toBe("Role");
        expect(role.Domain).toBe("sitecore");

        // Cleanup
        await callTool(client, "security-remove-role", { identity });
    });
});
