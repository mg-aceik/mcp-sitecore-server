import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../client";
import { resetLayoutById } from "../../tools/reset-layout";
import { getRenderingById } from "../../tools/get-rendering";

await client.connect(transport);

// /sitecore/content/Home/Tests/Presentation/Switch-Rendering-By-Unique-Id
const itemId = "{F8C6F8A2-A505-47C9-AB80-BFA551E616C0}";
const uniqueId = "{B343725A-3A93-446E-A9C8-3A2CBD3DB489}";

// /sitecore/layout/Renderings/Feature/Tests/Switch-Rendering/Expected Rendering
const newRenderingId = "{1C8B443B-E78A-4AE7-AB30-CB0166299877}";

const database = "master";
const language = "ja-jp";
const finalLayout = "true";

describe("powershell", () => {
    it("presentation-switch-rendering", async () => {
        // Arrange
        // Initialize item initial state before test.
        await resetLayoutById(client, itemId, database, language, finalLayout);

        const switchRenderingArgs: Record<string, any> = {
            id: itemId,
            uniqueId,
            newRenderingId,            
            database,
            finalLayout,
            language,
        };
        
        // Act
        await callTool(client, "presentation-switch-rendering", switchRenderingArgs);

        // Assert
        const renderings = await getRenderingById(client, itemId, database, undefined, language, finalLayout);
        
        const rendering = renderings[2];
        expect(rendering.ItemID.toLowerCase()).toBe(newRenderingId.toLowerCase());
    });
});