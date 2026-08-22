import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("common-test-base-template", async () => {
        // Arrange
        // /sitecore/content/Home/Tests/Common/Test-Base-Template
        const itemId = "{C9E88066-3A0D-4C87-BA12-2B9C8BBCB791}";
        const templatePath = "/sitecore/templates/Sample/Sample Item";
        
        const args: Record<string, any> = {
            id: itemId,
            template: templatePath
        };

        // Act
        const result = await callTool(client, "common-test-base-template", args);
        
        // Assert
        const json = JSON.parse(result.content[0].text);
        
        expect(json).toBeDefined();
        expect(json.Obj[0]).toBeTruthy();
    });
});
