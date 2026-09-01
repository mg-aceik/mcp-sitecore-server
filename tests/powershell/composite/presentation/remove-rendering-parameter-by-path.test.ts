import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../client";
import { seedScratch, seedPresentation, applyPresentation } from "../../../fixtures";

await client.connect(transport);

const scratch = await seedScratch("remove-rendering-parameter-by-path", ["Page"]);
const presentation = await seedPresentation(scratch);
const applied = await applyPresentation(scratch.item("Page"), presentation);
afterAll(() => scratch.cleanup());

const addressing = { path: `master:${scratch.item("Page").path}` };

describe("powershell", () => {
    it("presentation-remove-rendering-parameter", async () => {
        // Arrange
        await callTool(client, "presentation-set-rendering-parameter", {
            ...addressing,
            renderingUniqueId: applied.uniqueId,
            parameter: { sample: "value" },
            finalLayout: true,
        });

        // Act
        await callTool(client, "presentation-remove-rendering-parameter", {
            ...addressing,
            renderingUniqueId: applied.uniqueId,
            name: "sample",
            finalLayout: true,
        });

        // Assert
        const result = await callTool(client, "presentation-get-rendering", {
            ...addressing,
            uniqueId: applied.uniqueId,
            finalLayout: true,
        });
        const rendering = JSON.parse(result.content[0].text).Obj[0];

        expect(String(rendering.Parameters ?? "")).not.toContain("sample=value");
    });
});
