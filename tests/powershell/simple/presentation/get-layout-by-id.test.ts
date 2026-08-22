import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../client";

await client.connect(transport);

// /sitecore/content/Home/Tests/Presentation/Get-Layout-By-Id
const itemId = "{56ED9943-B12E-4D9B-A5DB-FBFCE45B8753}";
const sharedLayoutId = "{D6B14132-F0DE-4225-9006-1B41BC4E7852}";
const finalLayoutId = "{C36E76F8-576E-474F-9894-76C087CD89B5}";
const anotherLanguageLayoutId = "{800C8DAA-207D-43A7-8C69-EC84F1AF661D}";
const sharedLayoutDisplayName = "Shared";
const finalLayoutDisplayName = "Final";
const anotherLanguageLayoutDisplayName = "Another Language";

describe("powershell", () => {
    it("presentation-get-layout", async () => {
        // Arrange
        const args: Record<string, any> = {
            id: itemId,        
        };

        // Act
        const result = await callTool(client, "presentation-get-layout", args);
        const json = JSON.parse(result.content[0].text);

        // Assert
        const testObject = json.Obj[0];
        expect(testObject.ID.ToString.toLowerCase()).toBe(sharedLayoutId.toLowerCase());
        expect(testObject.DisplayName).toBe(sharedLayoutDisplayName);
    });

    it("presentation-get-layout-final-layout", async () => {
        // Arrange
        const args: Record<string, any> = {
            id: itemId,
            finalLayout: "true",
        };

        // Act
        const result = await callTool(client, "presentation-get-layout", args);
        const json = JSON.parse(result.content[0].text);

        // Assert
        const testObject = json.Obj[0];
        expect(testObject.ID.ToString.toLowerCase()).toBe(finalLayoutId.toLowerCase());
        expect(testObject.DisplayName).toBe(finalLayoutDisplayName);
    });

    it("presentation-get-layout-language", async () => {
        // Arrange
        const args: Record<string, any> = {
            id: itemId,
            finalLayout: "true",
            language: "ja-jp",
        };

        // Act
        const result = await callTool(client, "presentation-get-layout", args);
        const json = JSON.parse(result.content[0].text);

        // Assert
        const testObject = json.Obj[0];
        expect(testObject.ID.ToString.toLowerCase()).toBe(anotherLanguageLayoutId.toLowerCase());
        expect(testObject.DisplayName).toBe(anotherLanguageLayoutDisplayName);
    });
});