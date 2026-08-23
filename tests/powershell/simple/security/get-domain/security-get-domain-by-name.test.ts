import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("security-get-domain-by-name", async () => {
        const args: Record<string, string> = {
            name: "sitecore",
        };
        const result = await callTool(client, "security-get-domain-by-name", args);
        const json = JSON.parse(result.content[0].text);

        expect(json).toMatchObject({
            Obj: [
                {
                    ToString: "sitecore",
                    AccountNameValidation: "^\\w[\\w\\s\\.\\@\\-]*$",
                    AccountPrefix: "sitecore\\",
                    AnonymousUserEmailPattern: "",
                    AnonymousUserName: "sitecore\\Anonymous",
                    EveryoneRoleName: "sitecore\\Everyone",
                    MemberPattern: "sitecore\\*",
                    Name: "sitecore",
                    Appearance: {
                        ToString: "Sitecore.Data.Appearance",
                        DisplayName: "sitecore",
                        HelpLink: "",
                        Icon: "",
                        LongDescription: "",
                        ShortDescription: "",
                        Style: "",
                    },
                    EnsureAnonymousUser: false,
                    IsDefault: false,
                    LocallyManaged: false,
                    DefaultProfileItemID: "",
                },
            ],
        });
    });
});