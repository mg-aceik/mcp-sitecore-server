import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../../client";
import { seedUser } from "../../../../fixtures";

await client.connect(transport);

const user = await seedUser("set-password");
afterAll(() => user.remove());

describe("powershell", () => {
    it("security-set-user-password", async () => {
        const result = await callTool(client, "security-set-user-password", {
            identity: user.name,
            newPassword: "NewPassword1!",
            oldPassword: "b",
        });

        expect(result.isError).not.toBe(true);
    });
});
