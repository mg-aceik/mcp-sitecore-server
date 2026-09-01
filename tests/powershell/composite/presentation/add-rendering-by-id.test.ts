import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../client";
import { seedScratch, seedPresentation, applyPresentation } from "../../../fixtures";

await client.connect(transport);

const scratch = await seedScratch("add-rendering-by-id", ["Page"]);
const presentation = await seedPresentation(scratch);
await applyPresentation(scratch.item("Page"), presentation);
afterAll(() => scratch.cleanup());

const addressing = { id: scratch.item("Page").id };
const placeholder = "/test/placeholder";
const dataSource = "test_datasource";

describe("powershell", () => {
    it("presentation-add-rendering", async () => {
        // Act
        await callTool(client, "presentation-add-rendering", {
            ...addressing,
            renderingPath: `master:${presentation.otherRendering.path}`,
            placeHolder: placeholder,
            dataSource,
            finalLayout: true,
            index: 0,
        });

        // Assert
        const result = await callTool(client, "presentation-get-rendering", {
            ...addressing,
            placeholder,
            finalLayout: true,
        });
        const added = JSON.parse(result.content[0].text).Obj[0];

        expect(added.ItemID.toLowerCase()).toBe(presentation.otherRendering.id.toLowerCase());
        expect(added.Placeholder).toBe(placeholder);
        expect(added.Datasource).toBe(dataSource);
    });
});
