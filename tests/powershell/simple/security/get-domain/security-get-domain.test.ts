import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("security-get-domain", async () => {
        const result = await callTool(client, "security-get-domain", {});
        const json = JSON.parse(result.content[0].text);

        expect(json.Obj[0]).toMatchObject(
            {
                ToString: "default",
                AccountNameValidation: "^\\w[\\w\\s\\.\\@\\-]*$",
                AccountPrefix: "default\\",
                AnonymousUserEmailPattern: "",
                AnonymousUserName: "default\\Anonymous",
                EveryoneRoleName: "default\\Everyone",
                MemberPattern: "default\\*",
                Name: "default",
                Appearance: {
                    ToString: "Sitecore.Data.Appearance",
                    DisplayName: "default",
                    HelpLink: "",
                    Icon: "",
                    LongDescription: "",
                    ShortDescription: "",
                    Style: "",
                },
                EnsureAnonymousUser: true,
                IsDefault: true,
                LocallyManaged: false,
                DefaultProfileItemID: "",
            }
        );
    });
});