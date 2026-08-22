import { describe, it, expect } from "vitest";
import { callTool } from "@modelcontextprotocol/inspector/cli/build/client/tools.js";
import { client, transport } from "../../../client";
import { resetLayoutByPath } from "../../tools/reset-layout";
import { getRenderingByPath } from "../../tools/get-rendering";

await client.connect(transport);

const itemPath = "master:/sitecore/content/Home/Tests/Presentation/Switch-Rendering-By-Path";
const oldRenderingPath = "master:/sitecore/layout/Renderings/Sample/Sample Rendering";
const newRenderingPath = "master:/sitecore/layout/Renderings/Feature/Tests/Switch-Rendering/Expected Rendering";
const newRenderingId = "{1C8B443B-E78A-4AE7-AB30-CB0166299877}";

const language = "ja-jp";
const finalLayout = "true";

describe("powershell", () => {
    it("presentation-switch-rendering", async () => {
        // Arrange
        // Initialize item initial state before test.
        await resetLayoutByPath(client, itemPath, language, finalLayout);

        const switchRenderingArgs: Record<string, any> = {
            path: itemPath,
            oldRenderingPath,
            newRenderingPath,
            finalLayout,
            language,
        };
        
        // Act
        await callTool(client, "presentation-switch-rendering", switchRenderingArgs);

        // Assert
        const renderings = await getRenderingByPath(client, itemPath, undefined, language, finalLayout);
        
        const rendering = renderings[2];
        expect(rendering.ItemID.toLowerCase()).toBe(newRenderingId.toLowerCase());
    });
});