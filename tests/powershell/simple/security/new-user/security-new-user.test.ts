import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../../client";

await client.connect(transport);

const localName = `MCP-new-user-${Date.now().toString(36)}`;
const identity = `sitecore\\${localName}`;

describe("powershell", () => {
    it("security-new-user", async () => {
        // Act
        const created = await callTool(client, "security-new-user", {
            identity,
            password: "b",
            email: "mcp@example.com",
            fullName: "MCP Test User",
            comment: "created by the live suite",
            enabled: true,
        });
        expect(created.isError).not.toBe(true);

        // Assert -- the projected account: identity plus the profile fields.
        const result = await callTool(client, "security-get-user", { identity });
        const user = JSON.parse(result.content[0].text).Obj[0];

        expect(user.Name).toBe(identity);
        expect(user.LocalName).toBe(localName);
        expect(user.Domain).toBe("sitecore");
        expect(user.AccountType).toBe("User");
        expect(user.Email).toBe("mcp@example.com");
        expect(user.FullName).toBe("MCP Test User");
        expect(user.Comment).toBe("created by the live suite");

        // Cleanup
        await callTool(client, "security-remove-user", { identity });
    });
});
