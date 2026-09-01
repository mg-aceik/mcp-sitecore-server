import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../../client";
import { seedUser } from "../../../../fixtures";

await client.connect(transport);

const user = await seedUser("enable");
afterAll(() => user.remove());

describe("powershell", () => {
    it("security-enable-user", async () => {
        // Arrange
        await callTool(client, "security-disable-user", { identity: user.name });

        // Act
        await callTool(client, "security-enable-user", { identity: user.name });

        // Assert -- through `full`, since IsEnabled is not in the projection.
        const result = await callTool(client, "security-get-user", { identity: user.name, full: true });
        expect(JSON.parse(result.content[0].text).Obj[0].IsEnabled).toBe(true);
    });
});
