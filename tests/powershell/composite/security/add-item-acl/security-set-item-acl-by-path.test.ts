import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../../client";
import path from "path";

await client.connect(transport);

describe("powershell", () => {
    it("security-set-item-acl", async () => {
        const itemPath = "/sitecore/content/Home/Tests/Security/Add-Item-ACL/Add-Item-ACL-By-Path";
        const clearupAclArgs: Record<string, any> = {
            path: itemPath,
        };
        await callTool(client, "security-clear-item-acl", clearupAclArgs);
        // First, get existing ACL to verify we can read the item
        const getAclArgs: Record<string, any> = {
            path: itemPath,
        };
        const getOriginalAclResult = await callTool(client, "security-get-item-acl", getAclArgs);
        const originalAclJson = JSON.parse(getOriginalAclResult.content[0].text);

        // Add a new ACL entry - Deny write access to the Developer role
        const addAclArgs: Record<string, any> = {
            path: itemPath,
            identity: "sitecore\\Developer",
            accessRight: "item:write",
            propagationType: "Entity",
            securityPermission: "DenyAccess"
        };
        
        const addAclResult = await callTool(client, "security-set-item-acl", addAclArgs);
        const addAclJson = JSON.parse(addAclResult.content[0].text);

        // Sleep to ensure the ACL change is processed
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Verify the ACL was added by retrieving the item ACL again
        const getUpdatedAclResult = await callTool(client, "security-get-item-acl", getAclArgs);
        const updatedAclJson = JSON.parse(getUpdatedAclResult.content[0].text);
        
        expect(updatedAclJson.Obj).toBeDefined();
        console.log("Updated ACL JSON:", updatedAclJson);
        // Find the ACL entry we just added
        const hasAddedAcl = updatedAclJson.Obj.some((aclEntry: any) => 
            aclEntry.Account?.Name === "sitecore\\Developer" &&
            aclEntry.AccessRight?.Name === "item:write" &&
            aclEntry.PropagationType?.ToString === "Entity" &&
            aclEntry.SecurityPermission?.ToString === "DenyAccess"
        );
        
        expect(hasAddedAcl).toBe(true);
        
        // Clean up 
        await callTool(client, "security-clear-item-acl", clearupAclArgs);
    });
});