import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("common-remove-item-version-language", async () => {
        // Arrange
        // /sitecore/content/Home/Tests/Common/Remove-Item-Version-By-Id
        const itemId = "{FD02997A-5477-4E17-88A1-EDB9D879AA77}";
        const language = "fr-CA";

        const args: Record<string, any> = {
            id: itemId,
            language: language,
        };

        // Act
        await callTool(client, "common-remove-item-version", args);

        // Assert
        const getItemArgs: Record<string, any> = {
            id: itemId,
            language: language,
        };

        const result = await callTool(client, "provider-get-item", getItemArgs);
        const json = JSON.parse(result.content[0].text);

        expect(json.Obj).toBeUndefined();

        // Cleanup
        const addVersionArgs: Record<string, any> = {
            id: itemId,
            language: "en",
            targetLanguage: language
        };

        await callTool(client, "common-add-item-version", addVersionArgs);
    });

    it("common-remove-item-version-number", async () => {
        // Arrange
        const itemId = "{FD02997A-5477-4E17-88A1-EDB9D879AA77}";
        const language = "ja-JP";
        const version = "2";

        const args: Record<string, any> = {
            id: itemId,
            language: language,
            version: version,
        };

        // Act
        await callTool(client, "common-remove-item-version", args);

        // Assert
        const getItemArgs: Record<string, any> = {
            id: itemId,
            language: language,
            version: version
        };

        const result = await callTool(client, "provider-get-item", getItemArgs);
        const json = JSON.parse(result.content[0].text);

        expect(json.Obj).toBeUndefined();

        // Cleanup
        const addVersionArgs: Record<string, any> = {
            id: itemId,
            language: "en",
            targetLanguage: language
        };

        await callTool(client, "common-add-item-version", addVersionArgs);
    });
});
