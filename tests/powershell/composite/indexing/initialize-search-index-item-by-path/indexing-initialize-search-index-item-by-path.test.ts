import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("indexing-initialize-search-index-item", async () => {
        const testItemPath = "/sitecore/content/Home/Tests/Indexing/Initialize-SearchIndexItem-By-Path";

        const args: Record<string, any> = {
            path: testItemPath,
            indexName: "sitecore_test_index"
        };

        const result = await callTool(client, "indexing-initialize-search-index-item", args);
        const json = JSON.parse(result.content[0].text);

        // Verify that the command executed successfully
        expect(json).toBeDefined();

        // The result should be successful (no errors thrown)
        expect(result.content[0].text).toBeDefined();

        // find the item in the index
        const searchArgs: Record<string, any> = {
            index: "sitecore_test_index",
            criteria: [
                {
                    filter: "Equals",
                    field: "_path",
                    value: "{03BE9151-F1F3-4847-8CB8-FE36DE9CA33E}"
                }
            ],
            first: 1,  // Limiting results for test performance
            skip: 0
        };

        // sleep to ensure the indexing operation has time to complete
        await new Promise(resolve => setTimeout(resolve, 5000));
        const searchResult = await callTool(client, "indexing-find-item", searchArgs);
        const searchJson = JSON.parse(searchResult.content[0].text);
        // Verify that the search result is successful
        expect(searchJson).toBeDefined();
        expect(searchJson[0].Name).toBe("Initialize-SearchIndexItem-By-Path");
    });
});
