import { describe, it, expect } from "vitest";
import { callTool } from "@modelcontextprotocol/inspector/cli/build/client/tools.js";
import { client, transport } from "../../../client";
import { getCurrentLayoutId } from "../../tools/get-current-layout-id";

await client.connect(transport);

const itemId = "{1CDCD795-B650-4FB0-AF60-77BAEC572C32}";

// /sitecore/content/Home/Tests/Presentation/Set-Layout-By-Path
const itemPath = "master:/sitecore/content/Home/Tests/Presentation/Set-Layout-By-Path";

const testData: Record<string, Record<string, string>> = {
    layoutOne: {
        id: "{7BDF4126-6FF2-413F-A85F-154FF6372F55}",
        path: "master:/sitecore/layout/Layouts/Feature/Tests/Set-Layout/Layout One"
    },
    layoutTwo: {
        id: "{65B0B63C-55B5-4348-A009-10AB428E50D3}",
        path: "master:/sitecore/layout/Layouts/Feature/Tests/Set-Layout/Layout Two"
    }
};

describe("powershell", () => {
    it("presentation-set-layout", async () => {
        // Arrange
        const currentLayoutId = await getCurrentLayoutId(client, itemId);
        const expectedLayout = currentLayoutId.toLowerCase() === testData.layoutOne.id.toLowerCase() ?
            testData.layoutTwo : testData.layoutOne;

        const setLayoutArgs: Record<string, any> = {
            path: itemPath,
            layoutPath: expectedLayout.path,
            language: "ja-jp",
            finalLayout: "true",
        };

        // Act
        await callTool(client, "presentation-set-layout", setLayoutArgs);

        // Assert
        const layoutId = await getCurrentLayoutId(client, itemId);
        expect(layoutId.toLowerCase()).toBe(expectedLayout.id.toLowerCase());
    });
});