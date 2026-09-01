import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../../client";

await client.connect(transport);

const name = `MCP-remove-domain-${Date.now().toString(36)}`;

describe("powershell", () => {
    it("security-remove-domain", async () => {
        // Arrange
        await callTool(client, "security-new-domain", { name });
        const before = await callTool(client, "security-get-domain", { name });
        expect(JSON.parse(before.content[0].text).Obj[0].Name).toBe(name);

        // Act
        await callTool(client, "security-remove-domain", { name });

        // Assert: the domain is gone, so nothing comes back for its name.
        const after = await callTool(client, "security-get-domain", { name });
        const domains = after.isError ? [] : (JSON.parse(after.content[0].text).Obj ?? []);
        expect(domains.map((domain: any) => domain.Name)).not.toContain(name);
    });
});
