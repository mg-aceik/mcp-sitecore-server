import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../../client";
import { seedUser } from "../../../../fixtures";

await client.connect(transport);

const user = await seedUser("set-user");
afterAll(() => user.remove());

describe("powershell", () => {
    it("security-set-user", async () => {
        // Act
        await callTool(client, "security-set-user", {
            identity: user.name,
            email: "changed@example.com",
            fullName: "Changed Name",
            comment: "changed by the live suite",
        });

        // Assert
        const result = await callTool(client, "security-get-user", { identity: user.name });
        const updated = JSON.parse(result.content[0].text).Obj[0];

        expect(updated.Email).toBe("changed@example.com");
        expect(updated.FullName).toBe("Changed Name");
        expect(updated.Comment).toBe("changed by the live suite");
    });
});
