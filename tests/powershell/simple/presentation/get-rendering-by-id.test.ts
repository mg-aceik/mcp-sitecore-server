import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../client";

await client.connect(transport);

// /sitecore/content/Home/Tests/Presentation/Get-Rendering-By-Id
const itemId = "{2D0DEDAE-6EA4-47F9-81A4-D1D824B2ED05}";

const sampleRenderingId = "{493B3A83-0FA7-4484-8FC9-4680991CF743}";

const sampleRenderingUniqueId = "{B343725A-3A93-446E-A9C8-3A2CBD3DB489}";

const sampleRenderingPlaceholder = "/main/centercolumn/content";

const database = "master";

describe("powershell", () => {
    it("presentation-get-rendering-with-uniqueid", async () => {
        const args: Record<string, any> = {
            id: itemId,
            uniqueId: sampleRenderingUniqueId,       
            database,
        };

        // Act
        const result = await callTool(client, "presentation-get-rendering", args);
        const json = JSON.parse(result.content[0].text);

        // Assert
        const testObject = json.Obj[0];
        expect(testObject.ItemID.toLowerCase()).toBe(sampleRenderingId.toLowerCase());
        expect(testObject.UniqueId.toLowerCase()).toBe(sampleRenderingUniqueId.toLowerCase());
        expect(testObject.Placeholder).toBe(sampleRenderingPlaceholder);
    });

    it("presentation-get-rendering-with-filter-parameters", async () => {
        // Arrange
        const args: Record<string, any> = {
            id: itemId,
            placeholder: sampleRenderingPlaceholder,
            language: "ja-jp",
            finalLayout: "true",
            database,
        };

        // Act
        const result = await callTool(client, "presentation-get-rendering", args);
        const json = JSON.parse(result.content[0].text);

        // Assert
        const testObject = json.Obj[0];
        expect(testObject.ItemID.toLowerCase()).toBe(sampleRenderingId.toLowerCase());
        expect(testObject.UniqueId.toLowerCase()).toBe(sampleRenderingUniqueId.toLowerCase());
        expect(testObject.Placeholder).toBe(sampleRenderingPlaceholder);
    });
});