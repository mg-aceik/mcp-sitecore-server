import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../client";
import { resetLayoutByPath } from "../../tools/reset-layout";
import { getRenderingByPath } from "../../tools/get-rendering";

await client.connect(transport);

const itemPath = "/sitecore/content/Home/Tests/Presentation/Set-Rendering-Parameter-By-Path";

const renderingUniqueId = "{B343725A-3A93-446E-A9C8-3A2CBD3DB489}";
const parameter = {
    sample: "value_updated_by_path"
};
const language = "ja-jp";
const finalLayout = "true";

describe("powershell", () => {
    it("presentation-set-rendering-parameter", async () => {
        // Arrange
        // Initialize item initial state before test.
        await resetLayoutByPath(client, itemPath, language, finalLayout);

        const setRenderingParameterArgs: Record<string, any> =
        {
            path: itemPath,
            renderingUniqueId,
            parameter,
            language,
            finalLayout
        };
        
        // Act
        await callTool(client, "presentation-set-rendering-parameter", setRenderingParameterArgs);

        // Assert
        const renderings = await getRenderingByPath(client, itemPath, renderingUniqueId, language, finalLayout);
        const rendering = renderings[0];
        expect(rendering.Parameters).toContain("sample=value_updated_by_path");
    });
});
