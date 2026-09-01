import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../../client";
import { seedScratch, assignWorkflow, SAMPLE_WORKFLOW } from "../../../../fixtures";

await client.connect(transport);

// Submit is Sample Workflow's own command out of Draft, so the item has to be in Draft for
// the tool to have anything to invoke.
const scratch = await seedScratch("invoke-workflow-by-path", ["Target"]);
await assignWorkflow([scratch.item("Target")]);
afterAll(() => scratch.cleanup());

describe("powershell", () => {
    it("common-invoke-workflow", async () => {
        // Arrange
        const target = scratch.item("Target").path;

        // Act
        await callTool(client, "common-invoke-workflow", { path: target, commandName: "Submit" });

        // Assert
        const result = await callTool(client, "common-get-item-workflow-event", { path: target });
        const json = JSON.parse(result.content[0].text);
        const lastEvent = json.Obj[json.Obj.length - 1];

        expect(lastEvent.OldState).toBe(SAMPLE_WORKFLOW.draft);
        expect(lastEvent.NewState).toBe(SAMPLE_WORKFLOW.awaitingApproval);
    });
});
