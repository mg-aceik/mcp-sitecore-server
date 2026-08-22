import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("security-unlock-item", async () => {
        const itemId = "{0F4E79E6-1AE6-4C48-8C14-4E8275083EBB}"; 
        
        // First lock the item so we have something to unlock
        const lockArgs: Record<string, any> = {
            id: itemId,
            passThru: true
        };
        
        // Lock the item
        await callTool(client, "security-lock-item", lockArgs);
        
        // Now unlock the item
        const unlockArgs: Record<string, any> = {
            id: itemId,
            passThru: true
        };
        
        const result = await callTool(client, "security-unlock-item", unlockArgs);
        const json = JSON.parse(result.content[0].text);
        
        // Verify the item is unlocked
        expect(json.Obj[0].__Lock).not.contains("sitecore\\admin");
    });
});