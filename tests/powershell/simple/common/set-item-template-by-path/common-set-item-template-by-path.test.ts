import { describe, it, expect } from "vitest";
import { callTool } from "@modelcontextprotocol/inspector/cli/build/client/tools.js";
import { client, transport } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("common-set-item-template", async () => {
        // Arrange
        const itemPath = "/sitecore/content/Home/Tests/Common/Set-Item-Template-By-Path";
        const oldTemplatePath = "/sitecore/templates/Sample/Sample Item";
        const newTemplatePeth = "/sitecore/templates/Project/Verticals/Pages/Content Page";

        const args: Record<string, any> = {
            path: itemPath,
            template: newTemplatePeth,
        };

        // Act
        await callTool(client, "common-set-item-template", args);

        // Assert
        const getTemplateArgs: Record<string, any> = {
            path: itemPath,
        };

        const result = await callTool(client, "common-get-item-template", getTemplateArgs);
        const json = JSON.parse(result.content[0].text);
        
        expect(json).toBeDefined();
        expect(json.Obj[0].Name).toBe("Content Page");

        // Cleanup
        const setTemplateArgs: Record<string, any> = {
            path: itemPath,
            template: oldTemplatePath,
        };

        await callTool(client, "common-set-item-template", setTemplateArgs);
    });
});
