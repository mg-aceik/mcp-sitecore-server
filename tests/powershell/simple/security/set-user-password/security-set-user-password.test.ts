import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("security-set-user-password", async () => {
        // Create a test user with a random suffix to avoid conflicts
        const randomHexSuffix = Math.floor(Math.random() * 1000000).toString(16);
        const userName = `test-pwuser-${randomHexSuffix}`;
        const initialPassword = "InitialP@ss1";
        const newPassword = "NewP@ssw0rd2";
        const newerPassword = "NewerP@ssw0rd3";
        
        // 1. Create a test user first
        const newUserArgs: Record<string, any> = {
            identity: userName,
            password: initialPassword,
            email: "pwtest@example.com",
            fullName: "Password Test User",
            comment: "User for testing password changes",
            enabled: "true"
        };
        
        // Create the user
        const createResult = await callTool(client, "security-new-user", newUserArgs);
        const createJson = JSON.parse(createResult.content[0].text);
        expect(createJson.Obj[0].Name).toBe(`sitecore\\${userName}`);
        
        // 2. Set the user password with reset flag
        const setPasswordArgs: Record<string, any> = {
            identity: `sitecore\\${userName}`,
            newPassword: newPassword,
            resetPassword: "true"
        };
        
        const setPasswordResult = await callTool(client, "security-set-user-password", setPasswordArgs);
        const setPasswordJson = JSON.parse(setPasswordResult.content[0].text);
        
        // The response should be empty because Set-UserPassword doesn't return anything
        expect(setPasswordJson).toMatchObject({});
        
        // 3. Set the password again using the old password
        const setPasswordWithOldArgs: Record<string, any> = {
            identity: `sitecore\\${userName}`,
            newPassword: newerPassword,
            oldPassword: newPassword
        };
        
        const setPasswordWithOldResult = await callTool(client, "security-set-user-password", setPasswordWithOldArgs);
        const setPasswordWithOldJson = JSON.parse(setPasswordWithOldResult.content[0].text);
        
        // The response should be empty because Set-UserPassword doesn't return anything
        expect(setPasswordWithOldJson).toMatchObject({});
        
        // 4. Clean up - remove the test user
        const removeUserArgs: Record<string, string> = {
            identity: `sitecore\\${userName}`
        };
        
        await callTool(client, "security-remove-user", removeUserArgs);
    });
});