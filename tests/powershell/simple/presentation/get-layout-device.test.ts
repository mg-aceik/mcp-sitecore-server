import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../client";

await client.connect(transport);

// /sitecore/layout/Devices/Feed
const expectedDeviceId = "{73966209-F1B6-43CA-853A-F1DB1C9A654B}";
const expectedDeviceName = "Feed";

describe("powershell", () => {
    it("presentation-get-layout-device", async () => {
        // Arrange
        const args: Record<string, any> = {
            name: "Feed",
        };

        // Act
        const result = await callTool(client, "presentation-get-layout-device", args);

        // Assert
        const json = JSON.parse(result.content[0].text);
        const objectToAssert = json.Obj[0];

        expect(objectToAssert.ID.ToString.toLowerCase()).toBe(expectedDeviceId.toLowerCase());
        expect(objectToAssert.DisplayName).toBe(expectedDeviceName);
    });
});