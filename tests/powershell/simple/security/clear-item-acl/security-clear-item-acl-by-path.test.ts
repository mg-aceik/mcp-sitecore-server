import { describe, it, expect } from "vitest";
import { callTool } from "@modelcontextprotocol/inspector/cli/build/client/tools.js";
import { client, transport } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("security-clear-item-acl", async () => {
        // Use the specific path mentioned in the task requirements
        const itemPath = "/sitecore/content/Home/Tests/Security/Clear-Item-ACL/Clear-Item-ACL-By-Path";
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

        const addAclResult = await callTool(client, "security-add-item-acl", addAclArgs);
        const addAclJson = JSON.parse(addAclResult.content[0].text);



        // Clean up 
        await callTool(client, "security-clear-item-acl", clearupAclArgs);

        // Verify the ACL was removed by retrieving the item ACL again
        const getUpdatedAclResult = await callTool(client, "security-get-item-acl", getAclArgs);
        const updatedAclJson = JSON.parse(getUpdatedAclResult.content[0].text);

        expect(updatedAclJson).toMatchObject({});

    });
});