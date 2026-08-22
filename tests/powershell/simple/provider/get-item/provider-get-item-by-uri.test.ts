import { describe, it, expect } from "vitest";
import { callTool } from "@modelcontextprotocol/inspector/cli/build/client/tools.js";
import { client, transport } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("provider-get-item", async () => {
        // Use a URI that should exist in any Sitecore instance
        const itemUri = "sitecore://master/{058F0569-5129-4052-961D-0A61741BBFBB}?lang=en&ver=1";

        const args: Record<string, any> = {
            uri: itemUri
        };

        const result = await callTool(client, "provider-get-item", args);
        const json = JSON.parse(result.content[0].text);

        // Verify the response has the basic item properties
        expect(json).toMatchObject({
            Obj: expect.arrayContaining([
                expect.objectContaining({
                    ToString: "Sitecore.Data.Items.Item",
                    ItemPath: "/sitecore/content/Home/Tests/Provider/Get-Item/Get-Item-By-Uri",
                    FullPath: "/sitecore/content/Home/Tests/Provider/Get-Item/Get-Item-By-Uri",
                })
            ])
        });
    });
});
