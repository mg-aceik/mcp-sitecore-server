import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../../client";
import { seedScratch } from "../../../../fixtures";

await client.connect(transport);

const scratch = await seedScratch("get-item-field", ["Get-Item-Field"]);
afterAll(() => scratch.cleanup());

describe("powershell", () => {
    it("common-get-item-field", async () => {
        // Arrange
        const itemPath = scratch.item("Get-Item-Field").path;

        const args: Record<string, any> = {
            path: itemPath
        };

        // Act
        const result = await callTool(client, "common-get-item-field", args);

        // Assert
        const json = JSON.parse(result.content[0].text);

        expect(json).toBeDefined();
        expect(json.Obj).toEqual(expect.arrayContaining([
            "Text",
            "Title",
        ]));
    });
});
