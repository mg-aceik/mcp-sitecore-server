import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("indexing-get-search-index", async () => {
        // Test getting a specific index by name
        const specificIndexArgs: Record<string, any> = {
            name: "sitecore_master_index",
        };
        
        const specificIndexResult = await callTool(client, "indexing-get-search-index", specificIndexArgs);
        const specificIndexJson = JSON.parse(specificIndexResult.content[0].text);
        
        // Verify that the command executed successfully
        expect(specificIndexJson.Obj[0].Name).toBe("sitecore_master_index");
    });
});
