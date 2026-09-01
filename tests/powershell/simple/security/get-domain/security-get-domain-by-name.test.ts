import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("security-get-domain", async () => {
        const result = await callTool(client, "security-get-domain", { name: "sitecore" });
        const domains = JSON.parse(result.content[0].text).Obj;

        expect(domains).toHaveLength(1);

        // The projected domain: identity and membership, not the Appearance graph behind it.
        const domain = domains[0];
        expect(domain.Name).toBe("sitecore");
        expect(domain.AccountPrefix).toBe("sitecore\\");
        expect(domain.EveryoneRoleName).toBe("sitecore\\Everyone");
        expect(domain.MemberPattern).toBe("sitecore\\*");
        expect(typeof domain.IsDefault).toBe("boolean");
        expect(typeof domain.LocallyManaged).toBe("boolean");
    });
});
