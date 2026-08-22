import { describe, it, expect } from "vitest";
import { callTool } from "@modelcontextprotocol/inspector/cli/build/client/tools.js";
import { client, transport } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("security-unlock-item", async () => {
        // Using a common content path that should exist in most Sitecore instances
        const path = "/sitecore/content/Home/Tests/Security/Unlock-Item/Unlock-Item-By-Path";
        
        // First lock the item so we have something to unlock
        const lockArgs: Record<string, any> = {
            path: path,
            passThru: "true"
        };

        // Lock the item
        await callTool(client, "security-lock-item", lockArgs);
        
        // Now unlock the item
        const unlockArgs: Record<string, any> = {
            path: path,
            passThru: "true"
        };

        const result = await callTool(client, "security-unlock-item", unlockArgs);
        const json = JSON.parse(result.content[0].text);

        // Verify the item is unlocked
        expect(json.Obj[0].__Lock).not.contains("sitecore\\admin");
    });
});