import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../client";
import { seedScratch, seedPresentation, applyPresentation } from "../../../fixtures";

await client.connect(transport);

const scratch = await seedScratch("set-layout-by-path", ["Page"]);
const presentation = await seedPresentation(scratch);
await applyPresentation(scratch.item("Page"), presentation, { finalLayout: false });
afterAll(() => scratch.cleanup());

const addressing = { path: `master:${scratch.item("Page").path}` };

const currentLayoutId = async () => {
    const result = await callTool(client, "presentation-get-layout", { ...addressing, finalLayout: true });
    return String(JSON.parse(result.content[0].text).Obj[0].ID).toLowerCase();
};

describe("powershell", () => {
    it("presentation-set-layout", async () => {
        await callTool(client, "presentation-set-layout", {
            ...addressing,
            layoutId: presentation.otherLayout.id,
            finalLayout: true,
        });
        expect(await currentLayoutId()).toBe(presentation.otherLayout.id.toLowerCase());

        // And back, so the tool is shown to set rather than only to set once.
        await callTool(client, "presentation-set-layout", {
            ...addressing,
            layoutId: presentation.layout.id,
            finalLayout: true,
        });
        expect(await currentLayoutId()).toBe(presentation.layout.id.toLowerCase());
    });
});
