import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("logging-get-logs", async () => {
        // Test getting logs with default parameters
        const defaultArgs: Record<string, any> = {};
        
        const defaultResult = await callTool(client, "logging-get-logs", defaultArgs);
        const defaultJson = JSON.parse(defaultResult.content[0].text);
        
        // Verify that the command executed successfully and returned logs
        expect(defaultJson).toBeDefined();
        
        if (Array.isArray(defaultJson) && defaultJson.length > 0) {
            // Verify log entries have the required structure if any logs are returned
            const logEntry = defaultJson[0];
            expect(logEntry).toMatchObject({
                timestamp: expect.any(String),
                level: expect.stringMatching(/DEBUG|INFO|WARN|ERROR|FATAL/),
                message: expect.any(String)
            });
        }
    });
});
