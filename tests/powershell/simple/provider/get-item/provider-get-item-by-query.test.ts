import { describe, it, expect } from "vitest";
import { callTool } from "@modelcontextprotocol/inspector/cli/build/client/tools.js";
import { client, transport } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("provider-get-item", async () => {
        // Use a query that should return results in any Sitecore instance
        const query = "/sitecore/content/Home/Tests/Provider//*[@@name='Get-Item-By-Query']";

        const args: Record<string, any> = {
            query: query
        };

        const result = await callTool(client, "provider-get-item", args);
        const json = JSON.parse(result.content[0].text);

        // Verify the response has items array
        expect(json).toMatchObject({
            Obj: expect.arrayContaining([
                expect.objectContaining({
                    ToString: "Sitecore.Data.Items.Item",
                    ItemPath: "/sitecore/content/Home/Tests/Provider/Get-Item/Get-Item-By-Query",
                    FullPath: "/sitecore/content/Home/Tests/Provider/Get-Item/Get-Item-By-Query",
                })
            ])
        });
    });
});
