import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../client";
import { seedScratch, seedPresentation, applyPresentation } from "../../../fixtures";

await client.connect(transport);

// Merge pushes the final layout down into the shared one, so the two have to differ first.
const scratch = await seedScratch("merge-layout-by-id", ["Page"]);
const presentation = await seedPresentation(scratch);
await applyPresentation(scratch.item("Page"), presentation, { finalLayout: false });
afterAll(() => scratch.cleanup());

const addressing = { id: scratch.item("Page").id };

const currentLayoutId = async (finalLayout: boolean) => {
    const result = await callTool(client, "presentation-get-layout", { ...addressing, finalLayout });
    return String(JSON.parse(result.content[0].text).Obj[0].ID).toLowerCase();
};

describe("powershell", () => {
    it("presentation-merge-layout", async () => {
        // Arrange
        await callTool(client, "presentation-set-layout", {
            ...addressing,
            layoutId: presentation.otherLayout.id,
            finalLayout: true,
        });
        expect(await currentLayoutId(true)).toBe(presentation.otherLayout.id.toLowerCase());
        expect(await currentLayoutId(false)).toBe(presentation.layout.id.toLowerCase());

        // Act
        await callTool(client, "presentation-merge-layout", addressing);

        // Assert: the shared layout has taken on what the final layout held.
        expect(await currentLayoutId(false)).toBe(presentation.otherLayout.id.toLowerCase());
    });
});
