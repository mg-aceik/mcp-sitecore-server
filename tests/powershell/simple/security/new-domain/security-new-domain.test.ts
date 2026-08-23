// filepath: c:\source\mcp-sitecore-server\tests\powershell\simple\security\new-domain\security-new-domain.test.ts
import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../../client";
import e from "express";

await client.connect(transport);

describe("powershell", () => {
    it("security-new-domain", async () => {
        // Generate a unique domain name to avoid conflicts with existing domains
        const randomHexSuffix = Math.floor(Math.random() * 1000000).toString(16);
        const uniqueDomainName = `test-domain-${randomHexSuffix}`;

        const result = await callTool(client, "security-new-domain", {
            name: uniqueDomainName,
        });
        const json = JSON.parse(result.content[0].text);

        // Check that the response contains the domain we just created
        expect(json).toMatchObject({
            Obj: [
                {
                    ToString: expect.stringContaining(uniqueDomainName),
                    AccountNameValidation: "^\\w[\\w\\s\\.\\@\\-]*$",
                    AccountPrefix: expect.stringContaining(uniqueDomainName + "\\"),
                    AnonymousUserEmailPattern: "",
                    AnonymousUserName: expect.stringContaining(uniqueDomainName + "\\Anonymous"),
                    EveryoneRoleName: expect.stringContaining(uniqueDomainName + "\\Everyone"),
                    MemberPattern: expect.stringContaining(uniqueDomainName + "\\*"),
                    Name: expect.stringContaining(uniqueDomainName),
                    Appearance: {
                        ToString: "Sitecore.Data.Appearance",
                        DisplayName: expect.stringContaining(uniqueDomainName),
                        HelpLink: "",
                        Icon: "",
                        LongDescription: "",
                        ShortDescription: "",
                        Style: "",
                    },
                    EnsureAnonymousUser: true,
                    IsDefault: false,
                    LocallyManaged: false,
                    DefaultProfileItemID: "",

                },
            ],
        });

        // Verify the domain was created by retrieving it
        const verifyResult = await callTool(client, "security-get-domain-by-name", {
            name: uniqueDomainName
        });
        const verifyJson = JSON.parse(verifyResult.content[0].text);

        expect(verifyJson).toMatchObject({
            Obj: [
              {
                ToString: expect.stringContaining(uniqueDomainName),
                AccountNameValidation: "^\\w[\\w\\s\\.\\@\\-]*$",
                AccountPrefix: expect.stringContaining(uniqueDomainName + "\\"),
                AnonymousUserEmailPattern: "",
                AnonymousUserName: expect.stringContaining(uniqueDomainName + "\\Anonymous"),
                EveryoneRoleName: expect.stringContaining(uniqueDomainName + "\\Everyone"),
                MemberPattern: expect.stringContaining(uniqueDomainName + "\\*"),
                Name: expect.stringContaining(uniqueDomainName),
                Appearance: {
                  ToString: "Sitecore.Data.Appearance",
                  DisplayName: expect.stringContaining(uniqueDomainName),
                  HelpLink: "",
                  Icon: "",
                  LongDescription: "",
                  ShortDescription: "",
                  Style: "",
                },
                EnsureAnonymousUser: true,
                IsDefault: false,
                LocallyManaged: false,
                DefaultProfileItemID: "",
              },
            ],
          });

        // Clean up by removing the domain
        const removeResult = await callTool(client, "security-remove-domain", {
            name: uniqueDomainName
        });
    });
});