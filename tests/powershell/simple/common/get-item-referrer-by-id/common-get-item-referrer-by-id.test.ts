import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("common-get-item-referrer", async () => {
        // Using a known item ID for testing
        const itemId = "{67C31D9F-4D5B-40AD-846E-A268ADC36A9F}"; 
        
        const args: Record<string, any> = {
            id: itemId
        };

        const result = await callTool(client, "common-get-item-referrer", args);
        const json = JSON.parse(result.content[0].text);
        
        // Verify that the command executed successfully and returned referrer information
        expect(json.Obj[0].Name).toBe("Get-Item-Referrer-By-Path");
    });
});
