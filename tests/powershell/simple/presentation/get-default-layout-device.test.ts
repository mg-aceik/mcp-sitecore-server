import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../client";

await client.connect(transport);

// /sitecore/layout/Devices/Default
const expectedDeviceId = "{FE5D7FDF-89C0-4D99-9AA3-B5FBD009C9F3}";
const expectedDeviceName = "Default";

describe("powershell", () => {
    it("presentation-get-default-layout-device", async () => {
        // Arrange, Act
        const result = await callTool(client, "presentation-get-default-layout-device", {});

        // Assert
        const json = JSON.parse(result.content[0].text);
        const objectToAssert = json.Obj[0];

        expect(objectToAssert.ID.ToString.toLowerCase()).toBe(expectedDeviceId.toLowerCase());
        expect(objectToAssert.DisplayName).toBe(expectedDeviceName);
    });
});