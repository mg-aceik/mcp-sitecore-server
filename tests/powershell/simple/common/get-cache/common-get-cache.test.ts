import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("common-get-cache", async () => {
        // Test getting all caches
        const allCachesResult = await callTool(client, "common-get-cache", {});
        const allCachesJson = JSON.parse(allCachesResult.content[0].text);

        // Verify the response has basic structure
        expect(allCachesJson.Obj).toBeDefined();
        expect(Array.isArray(allCachesJson.Obj)).toBe(true);
        
        // Test that at least one cache exists
        expect(allCachesJson.Obj.length).toBeGreaterThan(0);
        
        });
});
