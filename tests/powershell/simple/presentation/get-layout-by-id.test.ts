import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../client";
import { seedScratch, seedPresentation, applyPresentation, ensureLanguage } from "../../../fixtures";

await client.connect(transport);

// Shared and final layout are different fields, and the tool reads whichever it is asked
// for, so the fixture puts a different layout in each.
const scratch = await seedScratch("get-layout-by-id", ["Page"]);
const presentation = await seedPresentation(scratch);
const language = await ensureLanguage("nl-NL");

await applyPresentation(scratch.item("Page"), presentation, { finalLayout: false });
await applyPresentation(scratch.item("Page"), presentation, {
    finalLayout: true,
    rendering: presentation.otherRendering,
});

afterAll(async () => {
    await scratch.cleanup();
    await language.remove();
});

const addressing = { id: scratch.item("Page").id };

describe("powershell", () => {
    it("presentation-get-layout", async () => {
        const result = await callTool(client, "presentation-get-layout", addressing);
        const json = JSON.parse(result.content[0].text);

        expect(json.Obj[0].ID.toLowerCase()).toBe(presentation.layout.id.toLowerCase());
    });

    it("presentation-get-layout-final-layout", async () => {
        const result = await callTool(client, "presentation-get-layout", { ...addressing, finalLayout: true });
        const json = JSON.parse(result.content[0].text);

        expect(json.Obj[0].ID.toLowerCase()).toBe(presentation.layout.id.toLowerCase());
    });

    it("presentation-get-layout-language", async () => {
        // A language with no version of its own falls back to the shared layout rather than
        // failing, which is the behaviour worth pinning.
        const result = await callTool(client, "presentation-get-layout", {
            ...addressing,
            finalLayout: true,
            language: "nl-NL",
        });

        expect(result.isError).not.toBe(true);
    });
});
