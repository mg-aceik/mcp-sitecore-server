import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("indexing-initialize-search-index", async () => {
        // Test initializing a specific index
        const specificIndexArgs: Record<string, any> = {
            name: "sitecore_test_index",
        };
        
        const specificIndexResult = await callTool(client, "indexing-initialize-search-index", specificIndexArgs);
        const specificIndexJson = JSON.parse(specificIndexResult.content[0].text);
        
        // Verify that the command executed successfully
        expect(specificIndexJson).toBeDefined();
        
        // Get the index status
        const getIndexArgs: Record<string, any> = {
            name: "sitecore_test_index",
        };

        const getIndexResult = await callTool(client, "indexing-get-search-index", getIndexArgs);
        const getIndexJson = JSON.parse(getIndexResult.content[0].text);
        // Verify that the index is initialized
        const datetime = new Date(getIndexJson.Obj[0].Summary.LastUpdated);
        const currentDatetime = new Date();
        const timeDiff = Math.abs(currentDatetime.getTime() - datetime.getTime());
        expect(timeDiff < 10000);
    });
});
