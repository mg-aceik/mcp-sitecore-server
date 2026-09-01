import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../client";
import { seedScratch, seedPresentation, applyPresentation } from "../../../fixtures";

await client.connect(transport);

const scratch = await seedScratch("remove-rendering-by-path", ["Page"]);
const presentation = await seedPresentation(scratch);
const applied = await applyPresentation(scratch.item("Page"), presentation);
afterAll(() => scratch.cleanup());

const addressing = { path: `master:${scratch.item("Page").path}` };

describe("powershell", () => {
    it("presentation-remove-rendering", async () => {
        // Arrange: the rendering the fixture added is there to start with.
        const before = await callTool(client, "presentation-get-rendering", { ...addressing, finalLayout: true });
        expect(JSON.parse(before.content[0].text).Obj).toHaveLength(1);

        // Act
        await callTool(client, "presentation-remove-rendering", {
            ...addressing,
            uniqueId: applied.uniqueId,
            finalLayout: true,
        });

        // Assert
        const after = await callTool(client, "presentation-get-rendering", { ...addressing, finalLayout: true });
        const remaining = JSON.parse(after.content[0].text).Obj ?? [];
        expect(remaining.map((rendering: any) => String(rendering.UniqueId).toLowerCase()))
            .not.toContain(applied.uniqueId.toLowerCase());
    });
});
