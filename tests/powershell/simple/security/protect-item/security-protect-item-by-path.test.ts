// filepath: c:\source\mcp-sitecore-server\tests\powershell\simple\security\protect-item\security-protect-item.test.ts
import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("security-protect-item", async () => {
        const itemPath = "/sitecore/content/Home/Tests/Security/Protect-Item/Protect-Item-By-Path"; 
        
        // Test protecting item by path
        const args: Record<string, any> = {
            path: itemPath,
            passThru: "true"
        };
        
        const result = await callTool(client, "security-protect-item", args);
        const json = JSON.parse(result.content[0].text);
        
        // Verify the item is protected
        expect(json.Obj[0]["__Read Only"]).toBe(1);

        await callTool(client, "security-unprotect-item", args);
    });
});