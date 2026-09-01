import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../client";
import { seedScratch, seedPresentation, applyPresentation } from "../../../fixtures";

await client.connect(transport);

const scratch = await seedScratch("set-rendering-by-id", ["Page"]);
const presentation = await seedPresentation(scratch);
const applied = await applyPresentation(scratch.item("Page"), presentation);
afterAll(() => scratch.cleanup());

const addressing = { id: scratch.item("Page").id };
const placeholder = "/test/placeholder";
const dataSource = "test_datasource";

describe("powershell", () => {
    it("presentation-set-rendering", async () => {
        // Act
        await callTool(client, "presentation-set-rendering", {
            ...addressing,
            uniqueId: applied.uniqueId,
            placeholder,
            dataSource,
            finalLayout: true,
            index: 0,
            parameter: {
                sample: "value",
            },
        });

        // Assert
        const result = await callTool(client, "presentation-get-rendering", {
            ...addressing,
            uniqueId: applied.uniqueId,
            finalLayout: true,
        });
        const rendering = JSON.parse(result.content[0].text).Obj[0];

        expect(rendering.ItemID.toLowerCase()).toBe(presentation.rendering.id.toLowerCase());
        expect(rendering.Placeholder).toBe(placeholder);
        expect(rendering.Datasource).toBe(dataSource);
        expect(rendering.Parameters).toContain("sample=value");
    });
});
