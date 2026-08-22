import { describe, it, expect } from "vitest";
import { callTool } from "@modelcontextprotocol/inspector/cli/build/client/tools.js";
import { client, transport } from "../../../client";
import { resetLayoutById } from "../../tools/reset-layout";
import { getRenderingById } from "../../tools/get-rendering";

await client.connect(transport);

// /sitecore/content/Home/Tests/Presentation/Remove-Rendering-By-Id
const itemId = "{4F0080AF-E681-4B89-95F9-BC3669546554}";

const sampleRenderingUniqueId = "{B343725A-3A93-446E-A9C8-3A2CBD3DB489}";

const language = "ja-jp";
const database = "master";
const finalLayout = "true";

describe("powershell", () => {
    it("presentation-remove-rendering", async () => {
        // Arrange
        // Initialize item initial state before test.        
        await resetLayoutById(client, itemId, database, language, finalLayout);

        const removeRenderingArgs: Record<string, any> = {
            id: itemId,
            uniqueId: sampleRenderingUniqueId,
            database,
            language,
            finalLayout,
        };

        // Act
        await callTool(client, "presentation-remove-rendering", removeRenderingArgs);

        // Assert
        const renderings = await getRenderingById(client, itemId, database, undefined, language, finalLayout);

        expect(renderings.length).toBe(2);
        const sampleRenderingIsPresent =
            renderings.some(x => x.UniqueId.toLowerCase() == sampleRenderingUniqueId.toLowerCase());

        expect(sampleRenderingIsPresent).toBe(false);
    });
});