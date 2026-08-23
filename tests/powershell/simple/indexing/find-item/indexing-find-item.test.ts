import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../../client";

await client.connect(transport);
describe("powershell", () => {
    it("indexing-find-item", async () => {
        // Define search criteria to find items with "FindItemTest" in their title
        const searchArgs: Record<string, any> = {
            index: "sitecore_master_index",
            criteria: [
                {
                    filter: "Contains",
                    field: "title_t_en",
                    value: "FindItemTest"
                }
            ],
            first: 10,  // Limiting results for test performance
            skip: 0
        };

        // Execute the find-item tool
        const result = await callTool(client, "indexing-find-item", searchArgs);
        const json = JSON.parse(result.content[0].text);
        expect(json[0].ItemId.toLowerCase()).toBe("{a044e42c-c52c-469f-b016-a17f3b92a4e5}"); // Example expected ID, adjust as necessary

    });
});

