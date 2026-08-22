import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../client";
import { resetLayoutByPath } from "../../tools/reset-layout";
import { getRenderingByPath } from "../../tools/get-rendering";

await client.connect(transport);

const itemPath = "master:/sitecore/content/Home/Tests/Presentation/Set-Rendering-By-Path";
const uniqueId = "{B343725A-3A93-446E-A9C8-3A2CBD3DB489}";
const sampleRenderingId = "{493B3A83-0FA7-4484-8FC9-4680991CF743}";
const language = "ja-jp";
const placeholder = "/test/placeholder";
const dataSource = "test_datasource";
const finalLayout = true;

describe("powershell", () => {
    it("presentation-set-rendering", async () => {
        // Arrange
        // Initialize item initial state before test.
        await resetLayoutByPath(client, itemPath, language, finalLayout);

        const setRenderingArgs: Record<string, any> = {
            path: itemPath,
            uniqueId,
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
        const renderings = await getRenderingByPath(client, itemPath, undefined, language, finalLayout);
        
        const rendering = renderings[0];
        expect(rendering.ItemID).toBe(sampleRenderingId);
        expect(rendering.Placeholder).toBe(placeholder);
        expect(rendering.Datasource).toBe(dataSource );
        expect(rendering.Parameters).toContain("sample=value");
    });
});
