import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../../client";
import { seedScratch, assignWorkflow, addWorkflowEvent, SAMPLE_WORKFLOW } from "../../../../fixtures";

await client.connect(transport);

// A stock item is in no workflow, so `Get-ItemWorkflowEvent` has nothing to report on one.
// Putting the seeded item into Sample Workflow's first state is what creates the event this
// reads back.
const scratch = await seedScratch("get-item-workflow-event-by-path", ["Target"]);
await assignWorkflow([scratch.item("Target")]);
await addWorkflowEvent(scratch.item("Target"));
afterAll(() => scratch.cleanup());

describe("powershell", () => {
    it("common-get-item-workflow-event", async () => {
        // Arrange, Act
        const result = await callTool(client, "common-get-item-workflow-event", { path: scratch.item("Target").path });

        // Assert
        const json = JSON.parse(result.content[0].text);

        expect(json).toBeDefined();
        expect(json.Obj.length).toBeGreaterThan(0);
        expect(json.Obj[json.Obj.length - 1].NewState).toBe(SAMPLE_WORKFLOW.draft);
    });
});
