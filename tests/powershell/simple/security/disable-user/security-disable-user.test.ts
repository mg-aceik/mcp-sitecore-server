import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../../client";
import { seedUser } from "../../../../fixtures";

await client.connect(transport);

const user = await seedUser("disable");
afterAll(() => user.remove());

describe("powershell", () => {
    it("security-disable-user", async () => {
        // Act
        await callTool(client, "security-disable-user", { identity: user.name });

        // Assert. Whether an account is enabled is not part of the projected account, so
        // this reads `IsEnabled` off the unprojected graph the `full` escape hatch returns.
        const result = await callTool(client, "security-get-user", { identity: user.name, full: true });
        expect(JSON.parse(result.content[0].text).Obj[0].IsEnabled).toBe(false);
    });
});
