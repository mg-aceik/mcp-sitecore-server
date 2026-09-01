import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("common-get-database", async () => {
        // Every CM has master and core; which others exist depends on the topology, so the
        // assertion names only those two.
        const result = await callTool(client, "common-get-database", {});
        const json = JSON.parse(result.content[0].text);

        const names = json.Obj.map((database: any) => database.Name);
        expect(names).toEqual(expect.arrayContaining(["master", "core"]));

        const master = json.Obj.find((database: any) => database.Name === "master");
        expect(master.Languages).toContain("en");
        expect(master.ReadOnly).toBe(false);
    });
});
