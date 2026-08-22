import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("common-get-item-template", async () => {
        const itemId = "{772CCBA4-9FF0-435B-87A2-1A3256023CE2}";
        
        const args: Record<string, any> = {
            id: itemId
        };

        const result = await callTool(client, "common-get-item-template", args);
        const json = JSON.parse(result.content[0].text);
        
        // Verify that the command executed successfully and returned template information
        expect(json).toBeDefined();
        expect(json.Obj[0].Name).toBe("Sample Item");
    });
});
