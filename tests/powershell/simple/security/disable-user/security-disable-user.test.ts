import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("security-disable-user", async () => {
        // Create a test user
        const randomHexSuffix = Math.floor(Math.random() * 1000000).toString(16);
        const newUserArgs: Record<string, string> = {
            identity: `anton-${randomHexSuffix}`,
            password: "anton",
            email: "at@exdst.com",
            fullName: "Anton Tishehnko",
            comment: "Anton Tishehnko",
            portrait: "office/16x16/default_user.png",
            enabled: "true",
            profileItemId: "{AE4C4969-5B7E-4B4E-9042-B2D8701CE214}",
        };
        
        // Create the user
        const createResult = await callTool(client, "security-new-user", newUserArgs);
        const createJson = JSON.parse(createResult.content[0].text);
        expect(createJson.Obj[0].Name).toBe(`sitecore\\anton-${randomHexSuffix}`);
        
        // Get the user and verify it's enabled
        const getUserArgs: Record<string, string> = {
            identity: `sitecore\\anton-${randomHexSuffix}`,
        };
        const getUserResult = await callTool(client, "security-get-user-by-identity", getUserArgs);
        const getUserJson = JSON.parse(getUserResult.content[0].text);
        expect(getUserJson.Obj[0].Name).toBe(`sitecore\\anton-${randomHexSuffix}`);
        expect(getUserJson.Obj[0].IsEnabled).toBe(true);
        
        // Disable the user
        const disableUserArgs: Record<string, string> = {
            identity: `sitecore\\anton-${randomHexSuffix}`,
        };
        const disableUserResult = await callTool(client, "security-disable-user", disableUserArgs);
        const disableUserJson = JSON.parse(disableUserResult.content[0].text);
        
        // Verify the response
        expect(disableUserJson).toMatchObject({});
        
        // Get the user again and verify it's now disabled
        const getUserAfterDisableResult = await callTool(client, "security-get-user-by-identity", getUserArgs);
        const getUserAfterDisableJson = JSON.parse(getUserAfterDisableResult.content[0].text);
        expect(getUserAfterDisableJson.Obj[0].Name).toBe(`sitecore\\anton-${randomHexSuffix}`);
        expect(getUserAfterDisableJson.Obj[0].IsEnabled).toBe(false);
        
        // Clean up - remove the test user
        const removeUserArgs: Record<string, string> = {
            identity: `sitecore\\anton-${randomHexSuffix}`,
        };
        await callTool(client, "security-remove-user", removeUserArgs);
    });
});