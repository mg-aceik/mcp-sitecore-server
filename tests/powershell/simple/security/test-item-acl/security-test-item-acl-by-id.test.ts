import { describe, it, expect } from "vitest";
import { callTool } from "@modelcontextprotocol/inspector/cli/build/client/tools.js";
import { client, transport } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("security-test-item-acl", async () => {
        const args: Record<string, any> = {
            id: "{8E1899B5-A688-49D3-82D6-AD0C21A07891}",
            identity: "sitecore\\Developer",
            accessRight: "item:read"
        };

        const result = await callTool(client, "security-test-item-acl", args);
        const json = JSON.parse(result.content[0].text);

        expect(json).toMatchObject({
            Obj: [
                true,
            ],
        }
        );
    });
});