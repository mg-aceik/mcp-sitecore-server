import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("security-unlock-user", async () => {
        // Create a test user with a random suffix to avoid conflicts
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
        //const createResult = await callTool(client, "security-new-user", newUserArgs);
        //const createJson = JSON.parse(createResult.content[0].text);
        //expect(createJson.Obj[0].Name).toBe(`sitecore\\anton-${randomHexSuffix}`);
        

        // IsLockedOut property
        // Login API doesn't work, it is not possible to lock user by attempts of login with wrong password
    });
});