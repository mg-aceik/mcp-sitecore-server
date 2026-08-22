import { describe, it, expect } from "vitest";
import { callTool } from "@modelcontextprotocol/inspector/cli/build/client/tools.js";
import { client, transport } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("common-get-item-referrer", async () => {
        // Using a known item path for testing
        const itemPath = "/sitecore/content/Home/Tests/Common/Get-Item-Referrer-By-Path";
        
        const args: Record<string, any> = {
            path: itemPath
        };

        const result = await callTool(client, "common-get-item-referrer", args);
        const json = JSON.parse(result.content[0].text);
        
        // Verify that the command executed successfully and returned referrer information
        expect(json.Obj[0].Name).toBe("Get-Item-Referrer-By-Id");
    });
});
