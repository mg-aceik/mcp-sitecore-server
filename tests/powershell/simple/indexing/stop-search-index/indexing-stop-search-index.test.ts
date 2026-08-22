import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("indexing-stop-search-index", async () => {
        // Test stopping a specific index
        const specificIndexArgs: Record<string, any> = {
            name: "sitecore_test_index_2",
        };

        const specificIndexResult = await callTool(client, "indexing-stop-search-index", specificIndexArgs);
        const specificIndexJson = JSON.parse(specificIndexResult.content[0].text);
        
        // Verify that the command executed successfully
        expect(specificIndexJson).toBeDefined();
        
        // How to check if the index is stopped?
        // There is no PowerShell command to do it. It requires calling .Net API via PS.
        // ToDo: Implement a way to verify that the index is stopped.
    });
});
