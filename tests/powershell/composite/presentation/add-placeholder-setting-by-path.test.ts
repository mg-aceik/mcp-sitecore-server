import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../client";
import { resetLayoutByPath } from "../../tools/reset-layout";

await client.connect(transport);

const itemPath = "master:/sitecore/content/Home/Tests/Presentation/Add-Placeholder-Setting-By-Path";

// /sitecore/layout/Placeholder Settings/Feature/Tests/Placeholder-Setting
const placeholderSettingId = "{2B3B1A5E-E231-40DF-BB5F-3EB0061ACC41}";
const placeholderSettingPath = "master:/sitecore/layout/Placeholder Settings/Feature/Tests/Placeholder-Setting";
const placeholderSettingKey = "new_placeholder_setting";

const language = "ja-jp";
const finalLayout = "true";

describe("powershell", () => {
    it("presentation-add-placeholder-setting", async () => {
        // Arrange
        // Initialize item initial state before test.
        await resetLayoutByPath(client, itemPath, language, finalLayout);

        const addPlaceholderSettingArgs: Record<string, any> = {
            path: itemPath,
            placeholderSettingPath,
            key: placeholderSettingKey,
            finalLayout,
            language,
        };

        // Act
        await callTool(client, "presentation-add-placeholder-setting", addPlaceholderSettingArgs);

        // Assert
        const getPlaceholderSettingArgs: Record<string, any> = {
            path: itemPath,
            language,
            finalLayout,
        };

        const result = await callTool(client, "presentation-get-placeholder-setting", getPlaceholderSettingArgs);
        
        const json = JSON.parse(result.content[0].text);
        const objectToAssert = json.Obj[0];
        expect(objectToAssert.Key).toBe(placeholderSettingKey);
        expect(objectToAssert.MetaDataItemId.toLowerCase()).toBe(placeholderSettingId.toLowerCase());
    });
});