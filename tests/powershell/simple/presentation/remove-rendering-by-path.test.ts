import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../client";
import { resetLayoutByPath } from "../../tools/reset-layout";
import { getRenderingByPath } from "../../tools/get-rendering";

await client.connect(transport);

const path = "master:/sitecore/content/Home/Tests/Presentation/Remove-Rendering-By-Path";

const sampleRenderingUniqueId = "{B343725A-3A93-446E-A9C8-3A2CBD3DB489}";

const language = "ja-jp";
const finalLayout = true;

describe("powershell", () => {
    it("presentation-remove-rendering", async () => {
        // Arrange
        // Initialize item initial state before test.        
        await resetLayoutByPath(client, path, language, finalLayout);

        const removeRenderingArgs: Record<string, any> = {
            path,
            uniqueId: sampleRenderingUniqueId,
            language,
            finalLayout,
        };

        // Act
        await callTool(client, "presentation-remove-rendering", removeRenderingArgs);

        // Assert
        const renderings = await getRenderingByPath(client, path, undefined, language, finalLayout);
        expect(renderings.length).toBe(2);
        const sampleRenderingIsPresent =
            renderings.some(x => x.UniqueId.toLowerCase() == sampleRenderingUniqueId.toLowerCase());

        expect(sampleRenderingIsPresent).toBe(false);
    });
});