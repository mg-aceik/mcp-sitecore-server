import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../../client";

await client.connect(transport);

const name = `MCP-new-domain-${Date.now().toString(36)}`;

describe("powershell", () => {
    it("security-new-domain", async () => {
        // Act
        const created = await callTool(client, "security-new-domain", { name });
        expect(created.isError).not.toBe(true);

        // Assert -- the projected domain.
        const result = await callTool(client, "security-get-domain", { name });
        const domain = JSON.parse(result.content[0].text).Obj[0];

        expect(domain.Name).toBe(name);
        expect(domain.AccountPrefix).toBe(`${name}\\`);
        expect(domain.MemberPattern).toBe(`${name}\\*`);

        // Cleanup
        await callTool(client, "security-remove-domain", { name });
    });
});
