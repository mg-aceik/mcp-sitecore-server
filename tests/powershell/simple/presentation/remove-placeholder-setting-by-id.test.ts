import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../client";
import { resetLayoutById } from "../../tools/reset-layout";

await client.connect(transport);

// /sitecore/content/Home/Tests/Presentation/Remove-Placeholder-Setting-By-Id
const itemId = "{8805A8AE-2A44-4464-AF99-322A93D1466F}";

const placeholderSettingUniqueId = "{77CD012F-A0EC-4B09-9F51-4AD4587B6490}";
const placeholderSettingKey = "test_placeholder";

const language = "ja-jp";
const database = "master";
const finalLayout = true;

async function getItemPlaceholderSettings(): Promise<any> {
    const getPlaceholderSettingArgs: Record<string, any> = {
        id: itemId,
        database,
        language,
        finalLayout,
    };

    const result = await callTool(client, "presentation-get-placeholder-setting", getPlaceholderSettingArgs);    
    const json = JSON.parse(result.content[0].text);

    return json.Obj;
}

describe("powershell", () => {
    it("presentation-remove-placeholder-setting-using-uniqueid", async () => {
        // Arrange
        // Initialize item initial state before test.        
        await resetLayoutById(client, itemId, database, language, finalLayout);

        const removePlaceholderSettingArgs: Record<string, any> = {
            id: itemId,
            database,
            uniqueId: placeholderSettingUniqueId,
            finalLayout,
            language,
        };

        // Act
        await callTool(client, "presentation-remove-placeholder-setting", removePlaceholderSettingArgs);

        // Assert
        const placeholderSettings = await getItemPlaceholderSettings();

        expect(placeholderSettings).toBeUndefined();
    });

    it("presentation-remove-placeholder-setting-using-key", async () => {
        // Arrange
        // Initialize item initial state before test.        
        await resetLayoutById(client, itemId, database, language, finalLayout);

        const removePlaceholderSettingArgs: Record<string, any> = {
            id: itemId,
            database,
            key: placeholderSettingKey,
            finalLayout,
            language,
        };

        // Act
        await callTool(client, "presentation-remove-placeholder-setting", removePlaceholderSettingArgs);

        // Assert
        const placeholderSettings = await getItemPlaceholderSettings();

        expect(placeholderSettings).toBeUndefined();
    });
});