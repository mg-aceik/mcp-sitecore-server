import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../client";
import { resetLayoutById } from "../../tools/reset-layout";
import { getRenderingById } from "../../tools/get-rendering";

await client.connect(transport);

// /sitecore/content/Home/Tests/Presentation/Remove-Rendering-Parameter-By-Id
const itemId = "{F2F97094-DEAD-4101-A888-17074C6A4B43}";

const renderingUniqueId = "{B343725A-3A93-446E-A9C8-3A2CBD3DB489}";
const name = "sample";
const finalLayout = true;
const language = "ja-jp";
const database = "master";

describe("powershell", () => {
    it("presentation-remove-rendering-parameter", async () => {
        // Arrange
        // Initialize item initial state before test.
        await resetLayoutById(client, itemId, database, language, finalLayout);

        const removeRenderingParameterArgs: Record<string, any> = {
            id: itemId,
            renderingUniqueId,
            name,
            database,
            language,
            finalLayout,
        };

        // Act
        await callTool(client, "presentation-remove-rendering-parameter", removeRenderingParameterArgs);

        // Assert
        const renderings = await getRenderingById(client, itemId, database, renderingUniqueId, language, finalLayout);
        const rendering = renderings[0];
        expect(rendering.Parameters).not.toContain(name);
    });
});
