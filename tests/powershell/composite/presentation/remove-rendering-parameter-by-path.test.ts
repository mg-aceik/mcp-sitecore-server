import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../client";
import { resetLayoutByPath } from "../../tools/reset-layout";
import { getRenderingByPath } from "../../tools/get-rendering";

await client.connect(transport);

const itemPath = "master:/sitecore/content/Home/Tests/Presentation/Remove-Rendering-Parameter-By-Path";

const renderingUniqueId = "{B343725A-3A93-446E-A9C8-3A2CBD3DB489}";
const name = "sample";
const finalLayout = true;
const language = "ja-jp";

describe("powershell", () => {
    it("presentation-remove-rendering-parameter", async () => {
        // Arrange
        // Initialize item initial state before test.
        await resetLayoutByPath(client, itemPath, language, finalLayout);

        const removeRenderingParameterArgs: Record<string, any> = {
            path: itemPath,
            renderingUniqueId,
            name,
            language,
            finalLayout,
        };

        // Act
        await callTool(client, "presentation-remove-rendering-parameter", removeRenderingParameterArgs);

        // Assert
        const renderings = await getRenderingByPath(client, itemPath, renderingUniqueId, language, finalLayout);
        const rendering = renderings[0];
        expect(rendering.Parameters).not.toContain(name);
    });
});
