import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("security-remove-domain", async () => {
        // Generate a unique domain name to avoid conflicts with existing domains
        const randomHexSuffix = Math.floor(Math.random() * 1000000).toString(16);
        const uniqueDomainName = `test-domain-${randomHexSuffix}`;

        const result = await callTool(client, "security-new-domain", {
            name: uniqueDomainName,
        });
        const json = JSON.parse(result.content[0].text);

        const removeResult = await callTool(client, "security-remove-domain", {
            name: uniqueDomainName
        });

        // Verify the domain was removed by attempting to retrieve it
        const verifyResult = await callTool(client, "security-get-domain-by-name", {
            name: uniqueDomainName
        });
        const verifyJson = JSON.parse(verifyResult.content[0].text);

        expect(verifyJson.Obj[0].ToString).toBe(`Cannot find a domain with name '${uniqueDomainName}'.`);
    });
});