import { describe, it, expect } from "vitest";
import { callTool } from "@modelcontextprotocol/inspector/cli/build/client/tools.js";
import { client, transport } from "../../../client";
import { resetLayoutByPath } from "../../tools/reset-layout";
import { getRenderingByPath } from "../../tools/get-rendering";

await client.connect(transport);

const itemPath = "master:/sitecore/content/Home/Tests/Presentation/Add-Rendering-By-Path";
const renderingPath = "master:/sitecore/layout/Renderings/Sample/Sample Rendering";
const sampleRenderingId = "{493B3A83-0FA7-4484-8FC9-4680991CF743}";
const language = "ja-jp";
const placeHolder = "/test/placeholder";
const dataSource = "test_datasource";
const finalLayout = "true";

describe("powershell", () => {
    it("presentation-add-rendering", async () => {
        // Arrange
        // Initialize item initial state before test.
        await resetLayoutByPath(client, itemPath, language, finalLayout);

        const addRenderingArgs: Record<string, any> = {
            path: itemPath,
            renderingPath,
            placeHolder,
            dataSource,
            finalLayout,
            language,
            index: 0,
        };

        // Act
        await callTool(client, "presentation-add-rendering", addRenderingArgs);

        // Assert
        const renderings = await getRenderingByPath(client, itemPath, undefined, language, finalLayout);;

        expect(renderings.length).toBe(4);
        const addedRendering = renderings[0];
        expect(addedRendering.ItemID).toBe(sampleRenderingId);
        expect(addedRendering.Placeholder).toBe(placeHolder);
        expect(addedRendering.Datasource).toBe(dataSource );
    });
});