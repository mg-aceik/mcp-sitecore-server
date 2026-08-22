import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../../client";
import { get } from "http";

await client.connect(transport);

describe("powershell", () => {
    it("security-remove-user", async () => {

        const randomHexSuffix = Math.floor(Math.random() * 1000000).toString(16);
        const newUserArgs: Record<string, unknown> = {
            identity: `anton-${randomHexSuffix}`,
            password: "anton",
            email: "at@exdst.com",
            fullName: "Anton Tishehnko",
            comment: "Anton Tishehnko",
            portrait: "office/16x16/default_user.png",
            enabled: true,
            profileItemId: "{AE4C4969-5B7E-4B4E-9042-B2D8701CE214}",
        };
        const result = await callTool(client, "security-new-user", newUserArgs);
        const json = JSON.parse(result.content[0].text);
        expect(json.Obj[0].Name).toBe(`sitecore\\anton-${randomHexSuffix}`);
        const getUserArgs: Record<string, string> = {
            identity: `sitecore\\anton-${randomHexSuffix}`,
        };

        const getUserResult = await callTool(client, "security-get-user-by-identity", getUserArgs);
        const getUserJson = JSON.parse(getUserResult.content[0].text);
        expect(getUserJson.Obj[0].Name).toBe(`sitecore\\anton-${randomHexSuffix}`);

        const removeUserArgs: Record<string, string> = {
            identity: `sitecore\\anton-${randomHexSuffix}`,
        };

        const removeUserResult = await callTool(client, "security-remove-user", removeUserArgs);
        const removeUserJson = JSON.parse(removeUserResult.content[0].text);

        expect(removeUserJson).toMatchObject(
            {}
        );

        const getUserResult2 = await callTool(client, "security-get-user-by-identity", getUserArgs);
        const getUserJson2 = JSON.parse(getUserResult2.content[0].text);
        expect(getUserJson2.Obj[0].ToString)
            .toBe(`Cannot find an account with identity 'sitecore\\anton-${randomHexSuffix}'.`);
    });
});