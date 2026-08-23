import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("security-set-user", async () => {
        // Create a test user with a random suffix to avoid conflicts
        const randomHexSuffix = Math.floor(Math.random() * 1000000).toString(16);
        const userName = `test-user-${randomHexSuffix}`;
        
        // 1. Create a test user first
        const newUserArgs: Record<string, any> = {
            identity: userName,
            password: "P@ssword1",
            email: "original@example.com",
            fullName: "Test User",
            comment: "Original comment",
            portrait: "office/16x16/default_user.png",
            enabled: true,
        };
        
        // Create the user
        const createResult = await callTool(client, "security-new-user", newUserArgs);
        const createJson = JSON.parse(createResult.content[0].text);
        expect(createJson.Obj[0].Name).toBe(`sitecore\\${userName}`);
        
        // 2. Get the user to verify initial properties
        const getUserArgs: Record<string, string> = {
            identity: `sitecore\\${userName}`
        };
        
        const getUserResult = await callTool(client, "security-get-user-by-identity", getUserArgs);
        const getUserJson = JSON.parse(getUserResult.content[0].text);
        
        expect(getUserJson.Obj[0].Name).toBe(`sitecore\\${userName}`);
        expect(getUserJson.Obj[0].Profile.Email).toBe("original@example.com");
        expect(getUserJson.Obj[0].Profile.FullName).toBe("Test User");
        expect(getUserJson.Obj[0].Profile.Comment).toBe("Original comment");
        
        // 3. Update the user with Set-User
        const setUserArgs: Record<string, string> = {
            identity: `sitecore\\${userName}`,
            email: "updated@example.com",
            fullName: "Updated Test User",
            comment: "Updated comment"
        };
        
        const setUserResult = await callTool(client, "security-set-user", setUserArgs);
        
        // 4. Get the user again to verify the changes
        const getUpdatedUserResult = await callTool(client, "security-get-user-by-identity", getUserArgs);
        const getUpdatedUserJson = JSON.parse(getUpdatedUserResult.content[0].text);
        
        // Verify updated properties
        expect(getUpdatedUserJson.Obj[0].Name).toBe(`sitecore\\${userName}`);
        expect(getUpdatedUserJson.Obj[0].Profile.Email).toBe("updated@example.com");
        expect(getUpdatedUserJson.Obj[0].Profile.FullName).toBe("Updated Test User");
        expect(getUpdatedUserJson.Obj[0].Profile.Comment).toBe("Updated comment");
        
        // 5. Clean up - remove the test user
        const removeUserArgs: Record<string, string> = {
            identity: `sitecore\\${userName}`
        };
        
        await callTool(client, "security-remove-user", removeUserArgs);
    });
});