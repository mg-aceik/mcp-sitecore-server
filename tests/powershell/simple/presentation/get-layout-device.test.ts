import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../client";

await client.connect(transport);

// /sitecore/layout/Devices/Feed, one of the devices Sitecore installs.
const FEED_DEVICE_ID = "{73966209-F1B6-43CA-853A-F1DB1C9A654B}";

describe("powershell", () => {
    it("presentation-get-layout-device", async () => {
        const result = await callTool(client, "presentation-get-layout-device", { name: "Feed" });
        const json = JSON.parse(result.content[0].text);

        const device = json.Obj[0];
        expect(device.ID.toLowerCase()).toBe(FEED_DEVICE_ID.toLowerCase());
        expect(device.Name).toBe("Feed");
    });
});
