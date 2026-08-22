import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../client";
import { getCurrentLayoutId } from "../../tools/get-current-layout-id";

await client.connect(transport);

// /sitecore/content/Home/Tests/Presentation/Set-Layout-By-Id
const itemId = "{9AC094BF-5EFD-4BE3-B04B-2C3CE926673B}";
const layoutOneId = "{7BDF4126-6FF2-413F-A85F-154FF6372F55}";
const layoutTwoId = "{65B0B63C-55B5-4348-A009-10AB428E50D3}";

describe("powershell", () => {
    it("presentation-set-layout", async () => {
        // Arrange
        const currentLayoutId = await getCurrentLayoutId(client, itemId);
        const expectedLayoutId = currentLayoutId.toLowerCase() === layoutOneId.toLowerCase() ?
            layoutTwoId.toLowerCase() : layoutOneId.toLowerCase();

        const setLayoutArgs: Record<string, any> = {
            id: itemId,
            layoutId: expectedLayoutId,
            language: "ja-jp",
            finalLayout: "true",
            database: "master",
        };

        // Act
        await callTool(client, "presentation-set-layout", setLayoutArgs);

        // Assert
        const layoutId = await getCurrentLayoutId(client, itemId);
        expect(layoutId.toLowerCase()).toBe(expectedLayoutId.toLowerCase());
    });
});