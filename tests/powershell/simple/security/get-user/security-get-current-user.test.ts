import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("security-get-current-user", async () => {
        // Whoever POWERSHELL_USERNAME names -- the assertion is on the shape of the
        // projected account, not on which account it happens to be.
        const result = await callTool(client, "security-get-current-user", {});
        const user = JSON.parse(result.content[0].text).Obj[0];

        expect(user.AccountType).toBe("User");
        expect(user.Name).toBe(`${user.Domain}\\${user.LocalName}`);
        expect(typeof user.IsAdministrator).toBe("boolean");
    });
});
