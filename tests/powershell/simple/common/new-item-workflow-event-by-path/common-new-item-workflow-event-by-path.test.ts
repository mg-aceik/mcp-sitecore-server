import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../../client";
import { seedScratch, assignWorkflow, SAMPLE_WORKFLOW } from "../../../../fixtures";

await client.connect(transport);

const scratch = await seedScratch("new-item-workflow-event-by-path", ["Target"]);
await assignWorkflow([scratch.item("Target")]);
afterAll(() => scratch.cleanup());

describe("powershell", () => {
    it("common-new-item-workflow-event", async () => {
        // Arrange
        const target = scratch.item("Target").path;

        // Act
        await callTool(client, "common-new-item-workflow-event", {
            path: target,
            oldState: SAMPLE_WORKFLOW.draft,
            newState: SAMPLE_WORKFLOW.awaitingApproval,
            text: "Action Comment"
        });

        // Assert
        const result = await callTool(client, "common-get-item-workflow-event", { path: target });
        const json = JSON.parse(result.content[0].text);
        const lastEvent = json.Obj[json.Obj.length - 1];

        expect(lastEvent.OldState).toBe(SAMPLE_WORKFLOW.draft);
        expect(lastEvent.NewState).toBe(SAMPLE_WORKFLOW.awaitingApproval);
        expect(lastEvent.CommentFields[0].Value).toBe("Action Comment");
    });
});
