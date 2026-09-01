import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../client";
import { seedScratch, seedPresentation, applyPresentation } from "../../../fixtures";

await client.connect(transport);

const scratch = await seedScratch("switch-rendering-by-unique-id", ["Page"]);
const presentation = await seedPresentation(scratch);
const applied = await applyPresentation(scratch.item("Page"), presentation);
afterAll(() => scratch.cleanup());

const addressing = { id: scratch.item("Page").id };

describe("powershell", () => {
    it("presentation-switch-rendering", async () => {
        // Act
        await callTool(client, "presentation-switch-rendering", {
            ...addressing,
            uniqueId: applied.uniqueId,
            newRenderingId: presentation.otherRendering.id,
            finalLayout: true,
        });

        // Assert: same slot, different rendering.
        const result = await callTool(client, "presentation-get-rendering", { ...addressing, finalLayout: true });
        const rendering = JSON.parse(result.content[0].text).Obj[0];

        expect(rendering.ItemID.toLowerCase()).toBe(presentation.otherRendering.id.toLowerCase());
    });
});
