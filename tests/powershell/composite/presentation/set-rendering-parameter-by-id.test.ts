import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../client";
import { resetLayoutById } from "../../tools/reset-layout";
import { getRenderingById } from "../../tools/get-rendering";

await client.connect(transport);

// /sitecore/content/Home/Tests/Presentation/Set-Rendering-Parameter-By-Id
const itemId = "{86BF4C06-0B3F-47FD-A631-D986D9A7D00B}";

const renderingUniqueId = "{B343725A-3A93-446E-A9C8-3A2CBD3DB489}";
const parameter = {
    sample: "value_updated"
};
const database = "master";
const language = "ja-jp";
const finalLayout = true;

describe("powershell", () => {
    it("presentation-set-rendering-parameter", async () => {
        // Arrange
        // Initialize item initial state before test.
        await resetLayoutById(client, itemId, database, language, finalLayout);

        const setRenderingParameterArgs: Record<string, any> =
        {
            id: itemId,
            renderingUniqueId,
            parameter,
            database,
            language,
            finalLayout
        };
        
        // Act
        await callTool(client, "presentation-set-rendering-parameter", setRenderingParameterArgs);

        // Assert
        const renderings = await getRenderingById(client, itemId, database, renderingUniqueId, language, finalLayout);
        const rendering = renderings[0];
        expect(rendering.Parameters).toContain("sample=value_updated");
    });
});
