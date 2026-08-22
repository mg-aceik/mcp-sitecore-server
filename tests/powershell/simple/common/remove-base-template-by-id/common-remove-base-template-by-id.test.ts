import { describe, it, expect } from "vitest";
import { callTool } from "@modelcontextprotocol/inspector/cli/build/client/tools.js";
import { client, transport } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("common-remove-base-template", async () => {
        // Arrange
        // /sitecore/templates/Sample/Sample Item
        const itemId = "{76036F5E-CBCE-46D1-AF0A-4143F9B557AA}";
        const baseTemplate = "/sitecore/templates/Project/Verticals/Page";

        const addBaseTemplateArgs: Record<string, any> = {
            id: itemId,
            template: baseTemplate,
        };

        await callTool(client, "common-add-base-template", addBaseTemplateArgs);

        const args: Record<string, any> = {
            id: itemId,
            template: baseTemplate,
        };

        // Act
        await callTool(client, "common-remove-base-template", args);

        // Assert
        const getTemplateArgs: Record<string, any> = {
            id: "{772CCBA4-9FF0-435B-87A2-1A3256023CE2}", // get an item based on the target template
        };

        const result = await callTool(client, "common-get-item-template", getTemplateArgs);
        const json = JSON.parse(result.content[0].text);
        const template = json.Obj[0];

        expect(template.BaseTemplates.map(x => x.Name)).not.toContain("Page");
    });
});
