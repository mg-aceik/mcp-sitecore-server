import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("security-set-item-acl", async () => {
        const itemId = "{1F9D7A0F-D002-41D3-8D8E-35376CD2A62A}";

        // Clean up 
        const clearupAclArgs: Record<string, any> = {
            id: itemId,
        };

        await callTool(client, "security-clear-item-acl", clearupAclArgs);

        const getAclArgs: Record<string, any> = {
            id: itemId,
        };

        // Add a new ACL entry - Deny read access to the Everyone role
        const addAclArgs: Record<string, any> = {
            id: itemId,
            identity: "sitecore\\Everyone",
            accessRight: "item:read",
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
            aclEntry.Account?.Name === "sitecore\\Everyone" &&
            aclEntry.AccessRight?.Name === "item:read" &&
            aclEntry.PropagationType?.ToString === "Entity" &&
            aclEntry.SecurityPermission?.ToString === "DenyAccess"
        );

        expect(hasAddedAcl).toBe(true);

        // Clean up 
        await callTool(client, "security-clear-item-acl", clearupAclArgs);
    });
});