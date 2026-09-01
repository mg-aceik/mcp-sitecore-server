import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../client";
import { seedScratch, seedPresentation, applyPresentation } from "../../../fixtures";

await client.connect(transport);

const scratch = await seedScratch("get-rendering-by-path", ["Page"]);
const presentation = await seedPresentation(scratch);
const placeholder = "/main/content";
const datasource = "test_datasource";
const applied = await applyPresentation(scratch.item("Page"), presentation, { placeholder, datasource });
afterAll(() => scratch.cleanup());

const path = `master:${scratch.item("Page").path}`;

describe("powershell", () => {
    it("presentation-get-rendering-with-uniqueid", async () => {
        const result = await callTool(client, "presentation-get-rendering", {
            path,
            uniqueId: applied.uniqueId,
            finalLayout: true,
        });
        const json = JSON.parse(result.content[0].text);

        const testObject = json.Obj[0];
        expect(testObject.ItemID.toLowerCase()).toBe(presentation.rendering.id.toLowerCase());
        expect(testObject.UniqueId.toLowerCase()).toBe(applied.uniqueId.toLowerCase());
        expect(testObject.Placeholder).toBe(placeholder);
    });

    it("presentation-get-rendering-with-filter-parameters", async () => {
        const result = await callTool(client, "presentation-get-rendering", {
            path,
            placeholder,
            finalLayout: true,
        });
        const json = JSON.parse(result.content[0].text);

        const testObject = json.Obj[0];
        expect(testObject.ItemID.toLowerCase()).toBe(presentation.rendering.id.toLowerCase());
        expect(testObject.UniqueId.toLowerCase()).toBe(applied.uniqueId.toLowerCase());
        expect(testObject.Datasource).toBe(datasource);
    });
});
