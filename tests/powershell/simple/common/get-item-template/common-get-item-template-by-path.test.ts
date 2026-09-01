import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../../client";
import { seedScratch } from "../../../../fixtures";

await client.connect(transport);

// The sibling files cover the projected result. This one covers `full: true`, the escape
// hatch that returns the unprojected .NET graph -- the only way to reach a template's
// sections, fields and base templates, none of which survive the projection.
const scratch = await seedScratch("get-item-template-full", ["Target"]);
afterAll(() => scratch.cleanup());

describe("powershell", () => {
    it("common-get-item-template full", async () => {
        const result = await callTool(client, "common-get-item-template", {
            path: scratch.item("Target").path,
            full: true,
        });
        const json = JSON.parse(result.content[0].text);

        const template = json.Obj[0];
        expect(template).toBeDefined();
        expect(template.Name).toBe(scratch.template.name);
        expect(template.ToString).toContain("Template");
        expect(template.Fields).toBeDefined();
        expect(template.BaseTemplates).toBeDefined();
        expect(template.OwnFields.map((field: any) => field.Name)).toEqual(
            expect.arrayContaining(["Title", "Text"])
        );
    });
});
