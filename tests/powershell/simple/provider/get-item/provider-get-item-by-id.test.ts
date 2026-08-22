import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("provider-get-item", async () => {
        const itemId = "{6BD1EE11-A5F6-4A15-8DBE-AE6E666F7380}";

        // Get the item by ID
        const args: Record<string, any> = {
            id: itemId
        };

        const result = await callTool(client, "provider-get-item", args);
        const json = JSON.parse(result.content[0].text);

        // Verify the response has the basic item properties
        expect(json).toMatchObject({
            Obj: expect.arrayContaining([
                expect.objectContaining({
                    ToString: "Sitecore.Data.Items.Item",
                    ItemPath: "/sitecore/content/Home/Tests/Provider/Get-Item/Get-Item-By-Id",
                    FullPath: "/sitecore/content/Home/Tests/Provider/Get-Item/Get-Item-By-Id",
                })
            ])
        });
    });
});
