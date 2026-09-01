import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("security-get-domain", async () => {
        // Omitting the name returns every domain. `sitecore` and `extranet` ship with the
        // product; nothing else is guaranteed, so only those two are named.
        const result = await callTool(client, "security-get-domain", {});
        const domains = JSON.parse(result.content[0].text).Obj;

        const names = domains.map((domain: any) => domain.Name);
        expect(names).toEqual(expect.arrayContaining(["sitecore", "extranet"]));

        const sitecore = domains.find((domain: any) => domain.Name === "sitecore");
        expect(sitecore.AccountPrefix).toBe("sitecore\\");
        expect(sitecore.MemberPattern).toBe("sitecore\\*");
    });
});
