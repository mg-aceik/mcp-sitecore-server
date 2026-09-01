import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../../client";
import { seedUser } from "../../../../fixtures";

await client.connect(transport);

const user = await seedUser("get-by-identity");
afterAll(() => user.remove());

describe("powershell", () => {
    it("security-get-user", async () => {
        const result = await callTool(client, "security-get-user", { identity: user.name });
        const returned = JSON.parse(result.content[0].text).Obj;

        expect(returned).toHaveLength(1);
        expect(returned[0].Name).toBe(user.name);
        expect(returned[0].LocalName).toBe(user.localName);
        expect(returned[0].Domain).toBe("sitecore");
        expect(returned[0].AccountType).toBe("User");
    });

    it("security-get-user reports an unknown identity as an error", async () => {
        const result = await callTool(client, "security-get-user", { identity: "sitecore\\no-such-user" });
        expect(result.isError).toBe(true);
    });
});
