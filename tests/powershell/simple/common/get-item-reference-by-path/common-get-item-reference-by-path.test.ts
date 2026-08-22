import { describe, it, expect } from "vitest";
import { callTool } from "@modelcontextprotocol/inspector/cli/build/client/tools.js";
import { client, transport } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("common-get-item-reference", async () => {
        // Using a known item path for testing
        const itemPath = "/sitecore/content/Home/Tests/Common/Get-Item-Reference-By-Path";
        
        const args: Record<string, any> = {
            path: itemPath
        };

        const result = await callTool(client, "common-get-item-reference", args);
        const json = JSON.parse(result.content[0].text);
        
        // Verify that the command executed successfully and returned reference information
        const names = json.Obj.map(item => item.Name);
        expect(names).toEqual(expect.arrayContaining([
            "Sample Item",
            "Draft",
            "Sample Workflow"
        ]));
    });
});
