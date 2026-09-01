import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("common-get-sitecore-job", async () => {
        // What jobs a CM is running depends on what it happens to be doing, so this asserts
        // the shape of the projection rather than the presence of any particular job.
        const result = await callTool(client, "common-get-sitecore-job", {});
        const json = JSON.parse(result.content[0].text);

        // An idle CM is running no jobs, and SPE leaves `Obj` off entirely rather than
        // sending an empty list -- so "no jobs" is a pass, not a missing property.
        const jobs = json.Obj ?? [];
        expect(Array.isArray(jobs)).toBe(true);
        for (const job of jobs) {
            expect(job).toHaveProperty("Name");
            expect(job).toHaveProperty("Handle");
            expect(job).toHaveProperty("IsDone");
            expect(job).toHaveProperty("State");
        }
    });
});
