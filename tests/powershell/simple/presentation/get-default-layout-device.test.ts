import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../client";

await client.connect(transport);

// Devices are part of Sitecore itself, not of any site, so these two ship with every CM and
// need no seeding.
const DEFAULT_DEVICE_ID = "{FE5D7FDF-89C0-4D99-9AA3-B5FBD009C9F3}";

describe("powershell", () => {
    it("presentation-get-layout-device", async () => {
        // Omitting the name asks for the default device -- what the retired
        // presentation-get-default-layout-device used to do.
        const result = await callTool(client, "presentation-get-layout-device", {});
        const json = JSON.parse(result.content[0].text);

        const device = json.Obj[0];
        expect(device.ID.toLowerCase()).toBe(DEFAULT_DEVICE_ID.toLowerCase());
        expect(device.Name).toBe("Default");
    });
});
