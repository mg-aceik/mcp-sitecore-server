import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../client";
import { resetLayoutById } from "../../tools/reset-layout";
import { getRenderingById } from "../../tools/get-rendering";

await client.connect(transport);

// /sitecore/content/Home/Tests/Presentation/Set-Rendering-By-Id
const itemId = "{5F6540F0-2680-437F-98E9-E20B6B6DB63C}";
const uniqueId = "{B343725A-3A93-446E-A9C8-3A2CBD3DB489}";
const sampleRenderingId = "{493B3A83-0FA7-4484-8FC9-4680991CF743}";
const language = "ja-jp";
const placeholder = "/test/placeholder";
const dataSource = "test_datasource";
const database = "master";
const finalLayout = "true";

describe("powershell", () => {
    it("presentation-set-rendering", async () => {
        // Arrange
        // Initialize item initial state before test.
        await resetLayoutById(client, itemId, database, language, finalLayout);

        const setRenderingArgs: Record<string, any> = {
            id: itemId,
            uniqueId,
            database,
            placeholder,
            dataSource,
            finalLayout,
            language,
            index: 0,
            parameter: {
                "sample": "value",
            },
        };

        // Act
        await callTool(client, "presentation-set-rendering", setRenderingArgs);

        // Assert
        const renderings = await getRenderingById(client, itemId, database, undefined, language, finalLayout);
        
        const rendering = renderings[0];
        expect(rendering.ItemID).toBe(sampleRenderingId);
        expect(rendering.Placeholder).toBe(placeholder);
        expect(rendering.Datasource).toBe(dataSource );
        expect(rendering.Parameters).toContain("sample=value");
    });
});
