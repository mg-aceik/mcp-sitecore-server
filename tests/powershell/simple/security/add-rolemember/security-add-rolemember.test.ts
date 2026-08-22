import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("security-add-role-member", async () => {
        // Create a test role with a random suffix to avoid conflicts
        const randomHexSuffix = Math.floor(Math.random() * 1000000).toString(16);
        const roleName = `custom-role-${randomHexSuffix}`;
        const userName = `test-user-${randomHexSuffix}`;
        
        // 1. Create a test role
        const newRoleArgs: Record<string, any> = {
            identity: roleName,
            description: "Test role created for add-role-member test"
        };
        const createRoleResult = await callTool(client, "security-new-role", newRoleArgs);
        const createRoleJson = JSON.parse(createRoleResult.content[0].text);
        expect(createRoleJson.Obj[0].Name).toBe(`sitecore\\${roleName}`);
        
        // 2. Create a test user
        const newUserArgs: Record<string, any> = {
            identity: userName,
            password: "P@ssw0rd",
            email: "test@example.com",
            fullName: "Test User",
            comment: "Test user created for add-role-member test"
        };
        const createUserResult = await callTool(client, "security-new-user", newUserArgs);
        const createUserJson = JSON.parse(createUserResult.content[0].text);
        expect(createUserJson.Obj[0].Name).toBe(`sitecore\\${userName}`);
        
        // 3. Add the user to the role
        const addRoleMemberArgs: Record<string, string> = {
            identity: `sitecore\\${roleName}`,
            members: `sitecore\\${userName}`
        };
        const addRoleMemberResult = await callTool(client, "security-add-role-member", addRoleMemberArgs);
        const addRoleMemberJson = JSON.parse(addRoleMemberResult.content[0].text);
        
        // 4. Verify the user is a member of the role by getting role members
        const getRoleMemberArgs: Record<string, string> = {
            identity: `sitecore\\${roleName}`
        };
        const getRoleMembersResult = await callTool(client, "security-get-role-member", getRoleMemberArgs);
        const getRoleMembersJson = JSON.parse(getRoleMembersResult.content[0].text);
        
        // Verify the test user is in the role members
        const memberFound = getRoleMembersJson.Obj.some((member: any) => 
            member.AccountType?.ToString === "User" && 
            member.Name === `sitecore\\${userName}`
        );
        expect(memberFound).toBe(true);
        
        // 5. Clean up - Remove user and role
        const removeUserArgs: Record<string, string> = {
            identity: `sitecore\\${userName}`
        };
        await callTool(client, "security-remove-user", removeUserArgs);
        
        const removeRoleArgs: Record<string, string> = {
            identity: `sitecore\\${roleName}`
        };
        await callTool(client, "security-remove-role", removeRoleArgs);
    });
});