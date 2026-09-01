import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../client";
import { seedScratch, seedPresentation, applyPresentation } from "../../../fixtures";

await client.connect(transport);

// Resetting the final layout drops back to the shared one, so the fixture puts a different
// layout in each: Layout One shared, Layout Two final.
const scratch = await seedScratch("reset-layout-by-path", ["Page"]);
const presentation = await seedPresentation(scratch);
await applyPresentation(scratch.item("Page"), presentation, { finalLayout: false });
afterAll(() => scratch.cleanup());

const addressing = { path: `master:${scratch.item("Page").path}` };

const currentLayoutId = async (finalLayout: boolean) => {
    const result = await callTool(client, "presentation-get-layout", { ...addressing, finalLayout });
    return String(JSON.parse(result.content[0].text).Obj[0].ID).toLowerCase();
};

describe("powershell", () => {
    it("presentation-reset-layout", async () => {
        // Arrange: a final layout that differs from the shared one.
        await callTool(client, "presentation-set-layout", {
            ...addressing,
            layoutId: presentation.otherLayout.id,
            finalLayout: true,
        });
        expect(await currentLayoutId(true)).toBe(presentation.otherLayout.id.toLowerCase());

        // Act
        await callTool(client, "presentation-reset-layout", { ...addressing, finalLayout: true });

        // Assert: back to the shared layout.
        expect(await currentLayoutId(true)).toBe(presentation.layout.id.toLowerCase());
    });
});
