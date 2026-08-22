import { describe, it, expect } from "vitest";
import { callTool } from "@modelcontextprotocol/inspector/cli/build/client/tools.js";
import { client, transport } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("common-remove-item-version-language", async () => {
        // Arrange
        const itemPath = "/sitecore/content/Home/Tests/Common/Remove-Item-Version-By-Path";
        const language = "fr-CA";
        
        const args: Record<string, any> = {
            path: itemPath,
            language: language,
        };

        // Act
        await callTool(client, "common-remove-item-version", args);

        // Assert
        const getItemArgs: Record<string, any> = {
            path: itemPath,
            language: language,
        };

        const result = await callTool(client, "provider-get-item", getItemArgs);
        const json = JSON.parse(result.content[0].text);
        
        expect(json.Obj).toBeUndefined();

        // Cleanup
        const addVersionArgs: Record<string, any> = {
            path: itemPath,
            language: "en",
            targetLanguage: language
        };

        await callTool(client, "common-add-item-version", addVersionArgs);
    });

    it("common-remove-item-version-number", async () => {
        // Arrange
        const itemPath = "/sitecore/content/Home/Tests/Common/Remove-Item-Version-By-Path";
        const language = "ja-JP";
        const version = "2";

        const args: Record<string, any> = {
            path: itemPath,
            language: language,
            version: version,
        };

        // Act
        await callTool(client, "common-remove-item-version", args);

        // Assert
        const getItemArgs: Record<string, any> = {
            path: itemPath,
            language: language,
            version: version
        };

        const result = await callTool(client, "provider-get-item", getItemArgs);
        const json = JSON.parse(result.content[0].text);

        expect(json.Obj).toBeUndefined();

        // Cleanup
        const addVersionArgs: Record<string, any> = {
            path: itemPath,
            language: "en",
            targetLanguage: language
        };

        await callTool(client, "common-add-item-version", addVersionArgs);
    });
});
