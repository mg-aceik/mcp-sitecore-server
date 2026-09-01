import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../client";
import { seedScratch, seedPresentation, applyPresentation } from "../../../fixtures";

await client.connect(transport);

const scratch = await seedScratch("set-rendering-parameter-by-id", ["Page"]);
const presentation = await seedPresentation(scratch);
const applied = await applyPresentation(scratch.item("Page"), presentation);
afterAll(() => scratch.cleanup());

const addressing = { id: scratch.item("Page").id };

describe("powershell", () => {
    it("presentation-set-rendering-parameter", async () => {
        // Act
        await callTool(client, "presentation-set-rendering-parameter", {
            ...addressing,
            renderingUniqueId: applied.uniqueId,
            parameter: { sample: "value" },
            finalLayout: true,
        });

        // Assert
        const result = await callTool(client, "presentation-get-rendering-parameter", {
            ...addressing,
            renderingUniqueId: applied.uniqueId,
            finalLayout: true,
        });

        expect(result.content[0].text).toContain("value");
    });
});
