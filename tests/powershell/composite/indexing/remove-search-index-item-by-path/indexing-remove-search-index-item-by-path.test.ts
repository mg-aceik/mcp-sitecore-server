import { describe, it, expect } from "vitest";
import { callTool } from "@modelcontextprotocol/inspector/cli/build/client/tools.js";
import { client, transport } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("indexing-remove-search-index-item", async () => {
        const testItemPath = "/sitecore/content/Home/Tests/Indexing/Remove-SearchIndexItem-By-Path";

        // First, add the item to the index to ensure it exists
        const addToIndexArgs: Record<string, any> = {
            path: testItemPath,
            indexName: "sitecore_test_index"
        };
        
        // Add the item to the index first
        await callTool(client, "indexing-initialize-search-index-item", addToIndexArgs);

        // Now test removing the item from the index
        const removeArgs: Record<string, any> = {
            path: testItemPath,
            indexName: "sitecore_test_index"
        };
        
        const result = await callTool(client, "indexing-remove-search-index-item", removeArgs);
        const json = JSON.parse(result.content[0].text);
        
        // Verify that the command executed successfully
        expect(json).toBeDefined();
        
        // The result should be successful (no errors thrown)
        expect(result.content[0].text).toBeDefined();

        // Verify that the item is no longer in the index
        const searchArgs: Record<string, any> = {
            index: "sitecore_test_index",
            criteria: [
                {
                    filter: "Equals",
                    field: "_path",
                    value: "{9EA06B86-A894-431E-9901-E62640170DA0}"
                }
            ],
            first: 1,
            skip: 0
        };

        // sleep to ensure the indexing operation has time to complete
        await new Promise(resolve => setTimeout(resolve, 5000));

        const searchResult = await callTool(client, "indexing-find-item", searchArgs);
        expect(searchResult.content[0].text).toBe("No items found."); // Expect no items to be found after removal
    });
});
