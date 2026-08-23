import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("indexing-suspend-search-index", async () => {
        // Test suspending a specific index
        const specificIndexArgs: Record<string, any> = {
            name: "sitecore_test_index_3",
        };

        const specificIndexResult = await callTool(client, "indexing-suspend-search-index", specificIndexArgs);
        const specificIndexJson = JSON.parse(specificIndexResult.content[0].text);
        
        // Verify that the command executed successfully
        expect(specificIndexJson).toBeDefined();

        // How to check if the index is suspended?
        // There is no PowerShell command to do it. It requires calling .Net API via PS.
        // ToDo: Implement a way to verify that the index is suspended.
    });
});
