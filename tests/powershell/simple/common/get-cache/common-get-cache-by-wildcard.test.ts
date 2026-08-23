import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("common-get-cache", async () => {
        // Test getting a specific cache
        const specificCacheArgs: Record<string, string> = {
            name: "admin*",
        };
        
        const specificCacheResult = await callTool(client, "common-get-cache", specificCacheArgs);
        const specificCacheJson = JSON.parse(specificCacheResult.content[0].text);
        
        // Verify the response contains caches matching the name pattern
        // "admin[xsl]" should be present in the result
        expect(specificCacheJson.Obj).toBeDefined();
        expect(Array.isArray(specificCacheJson.Obj)).toBe(true);
        expect(specificCacheJson.Obj.some((cache: any) => cache.Name.includes("admin[xsl]"))).toBe(true);
    });
});
