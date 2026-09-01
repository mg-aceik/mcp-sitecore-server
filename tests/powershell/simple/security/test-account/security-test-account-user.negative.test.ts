import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("security-test-account", async () => {
        // A name nothing could have created: the tool answers false rather than failing.
        const result = await callTool(client, "security-test-account", {
            identity: "sitecore\\MCP-no-such-user-at-all",
            accountType: "User",
        });

        expect(JSON.parse(result.content[0].text).Obj[0]).toBe(false);
    });
});
