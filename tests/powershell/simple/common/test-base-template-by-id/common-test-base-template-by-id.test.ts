import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../../client";
import { seedScratch } from "../../../../fixtures";

await client.connect(transport);

// Every data template derives from the Standard template, so it is the one base every
// seeded item is guaranteed to have.
const STANDARD_TEMPLATE = "/sitecore/templates/System/Templates/Standard template";

const scratch = await seedScratch("test-base-template-by-id", ["Target"]);
afterAll(() => scratch.cleanup());

describe("powershell", () => {
    it("common-test-base-template", async () => {
        const inherited = await callTool(client, "common-test-base-template", {
            id: scratch.item("Target").id,
            template: STANDARD_TEMPLATE
        });
        expect(JSON.parse(inherited.content[0].text).Obj[0]).toBe(true);

        // A template the item does not derive from answers the other way, which is the half
        // of the tool a single positive case never exercises.
        const unrelated = await callTool(client, "common-test-base-template", {
            id: scratch.item("Target").id,
            template: "/sitecore/templates/System/Templates/Template section"
        });
        expect(JSON.parse(unrelated.content[0].text).Obj[0]).toBe(false);
    });
});
