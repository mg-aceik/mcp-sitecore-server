// filepath: c:\source\mcp-sitecore-server\tests\powershell\simple\security\unprotect-item\security-unprotect-item.test.ts
import { describe, it, expect } from "vitest";
import { callTool } from "@modelcontextprotocol/inspector/cli/build/client/tools.js";
import { client, transport } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("security-unprotect-item", async () => {
        const itemPath = "/sitecore/content/Home/Tests/Security/Unprotect-Item/Unprotect-Item-By-Path"; 
        const args: Record<string, any> = {
            path: itemPath,
            passThru: "true"
        };
        // First protect the item to ensure we have something to unprotect
        await callTool(client, "security-protect-item", args);
        
        const result = await callTool(client, "security-unprotect-item", args);
        const json = JSON.parse(result.content[0].text);
        
        // Verify the item is no longer protected
        expect(json.Obj[0]["__Read Only"]).toBe("");
    });
});