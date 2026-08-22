import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("common-get-database", async () => {
        // Test getting all databases
        const allDatabasesResult = await callTool(client, "common-get-database", {});
        const allDatabasesJson = JSON.parse(allDatabasesResult.content[0].text);

        expect(allDatabasesJson.Obj[0].ToString).toBe("master");
    });
});
