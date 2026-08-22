import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("common-get-archive", async () => {
        // Arrange
        const archiveName = "recyclebin";

        const args: Record<string, any> = {
            name: archiveName,
        };

        // Act
        const result = await callTool(client, "common-get-archive", args);

        // Assert
        const json = JSON.parse(result.content[0].text);
        const archive = json.Obj[0];

        expect(archive.Name).toBe(archiveName);
    });
});
