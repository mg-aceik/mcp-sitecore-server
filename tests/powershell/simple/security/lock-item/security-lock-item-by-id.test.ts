import { describe, it, expect } from "vitest";
import { callTool } from "@modelcontextprotocol/inspector/cli/build/client/tools.js";
import { client, transport } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("security-lock-item", async () => {
       const itemId = "{1ADB079D-DD98-487A-BC2E-31E2D9880DBF}"; 
        // Test locking by ID
        const args: Record<string, any> = {
            id: itemId,
            passThru: "true"
        };
        
        const result = await callTool(client, "security-lock-item", args);
        const json = JSON.parse(result.content[0].text);
        
        expect(json.Obj[0].__Lock).contains(
            "sitecore\\admin"
        );
        
        // Unlock the item after test to clean up
        const forceArgs: Record<string, any> = {
            id: itemId,
        };
        
        await callTool(client, "security-unlock-item", forceArgs);
    });
});