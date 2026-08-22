import { describe, it, expect } from "vitest";
import { callTool } from "@modelcontextprotocol/inspector/cli/build/client/tools.js";
import { client, transport } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("provider-get-item", async () => {
        // Use a path that should exist in any Sitecore instance
        const itemPath = "/sitecore/content/Home/Tests/Provider/Get-Item/Get-Item-By-Path";

        const args: Record<string, any> = {
            path: itemPath
        };

        const result = await callTool(client, "provider-get-item", args);
        const json = JSON.parse(result.content[0].text);

        // Verify the response has the basic item properties
        expect(json).toMatchObject({
            Obj: expect.arrayContaining([
                expect.objectContaining({
                    ToString: "Sitecore.Data.Items.Item",
                    ItemPath: "/sitecore/content/Home/Tests/Provider/Get-Item/Get-Item-By-Path",
                    FullPath: "/sitecore/content/Home/Tests/Provider/Get-Item/Get-Item-By-Path",
                })
            ])
        });
    });
});
