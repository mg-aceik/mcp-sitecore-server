import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("common-get-item-template", async () => {
        // Use the Home item path which exists in any Sitecore instance
        const homePath = "/sitecore/content/Home/Tests/Common/Get-Item-Template-By-Path";
        
        const args: Record<string, any> = {
            path: homePath
        };

        const result = await callTool(client, "common-get-item-template", args);
        const json = JSON.parse(result.content[0].text);
        
        // Verify that the command executed successfully and returned template information
        expect(json).toBeDefined();
        expect(json.Obj[0].Name).toBe("Sample Item");
    });
});
