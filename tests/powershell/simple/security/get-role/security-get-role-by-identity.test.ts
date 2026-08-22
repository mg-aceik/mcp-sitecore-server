import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("security-get-role-by-identity", async () => {
        const args: Record<string, string> = {
            identity: "sitecore\\Author",
        };
        const result = await callTool(client, "security-get-role-by-identity", args);
        const json = JSON.parse(result.content[0].text);

        expect(json).toMatchObject({
            Obj: [
                {
                    ToString: "Sitecore.Security.Accounts.Role",
                    Domain: {
                        ToString: "sitecore",
                        AccountNameValidation: "^\\w[\\w\\s\\.\\@\\-]*$",
                        AccountPrefix: "sitecore\\",
                        AnonymousUserEmailPattern: "",
                        AnonymousUserName: "sitecore\\Anonymous",
                        EveryoneRoleName: "sitecore\\Everyone",
                        MemberPattern: "sitecore\\*",
                        Name: "sitecore",
                        Appearance: expect.anything(),
                        EnsureAnonymousUser: false,
                        IsDefault: false,
                        LocallyManaged: false,
                        DefaultProfileItemID: "",
                    },
                    AccountType: {
                        ToString: "Role",
                    },
                    IsEveryone: false,
                    IsGlobal: false,
                    Description: "Role",
                    DisplayName: "sitecore\\Author",
                    LocalName: "sitecore\\Author",
                    Name: "sitecore\\Author",
                    Roles: {
                        ToString: "Sitecore.Security.Accounts.Role",
                        IsEveryone: false,
                        IsGlobal: true,
                        AccountType: "Role",
                        Description: "Role",
                        DisplayName: "sitecore\\Sitecore Client Authoring",
                        LocalName: "sitecore\\Sitecore Client Authoring",
                        Name: "sitecore\\Sitecore Client Authoring",
                        Roles: "Sitecore.Security.Accounts.Role",
                        MemberOf: "Sitecore.Security.Accounts.Role",
                    },
                    MemberOf: {
                        ToString: "Sitecore.Security.Accounts.Role",
                        IsEveryone: false,
                        IsGlobal: true,
                        AccountType: "Role",
                        Description: "Role",
                        DisplayName: "sitecore\\Sitecore Client Authoring",
                        LocalName: "sitecore\\Sitecore Client Authoring",
                        Name: "sitecore\\Sitecore Client Authoring",
                        Roles: "Sitecore.Security.Accounts.Role",
                        MemberOf: "Sitecore.Security.Accounts.Role",
                    },
                },
            ],
        });
    });
});