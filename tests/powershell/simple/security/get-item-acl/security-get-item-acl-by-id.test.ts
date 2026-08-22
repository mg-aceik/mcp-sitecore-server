import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("security-get-item-acl", async () => {
        // Use the specific ID mentioned in the task requirements
        const itemId = "{E1CE1D05-0011-405F-9958-82D0C69D6FD3}";

        const args: Record<string, any> = {
            id: itemId
        };

        const result = await callTool(client, "security-get-item-acl", args);
        const json = JSON.parse(result.content[0].text);

        // Verify the response has access rules
        expect(json).toMatchObject({
            Obj: [
                {
                    ToString: "Sitecore.Security.AccessControl.AccessRule",
                    AccessRight: {
                        ToString: "item:delete",
                        Comment: "Delete right for items.",
                        Name: "item:delete",
                        Title: "Delete",
                        IsFieldRight: false,
                        IsItemRight: true,
                        IsLanguageRight: false,
                        IsSiteRight: false,
                        IsWorkflowCommandRight: false,
                        IsWorkflowStateRight: false,
                        IsWildcard: false,
                        ModifiesData: true,
                    },
                    Account: {
                        ToString: "Sitecore.Security.Accounts.Role",
                        Domain: expect.anything(),
                        IsEveryone: false,
                        IsGlobal: false,
                        AccountType: "Role",
                        Description: "Role",
                        DisplayName: "sitecore\\Author",
                        LocalName: "sitecore\\Author",
                        Name: "sitecore\\Author",
                        Roles: "Sitecore.Security.Accounts.Role",
                        MemberOf: "Sitecore.Security.Accounts.Role",
                    },
                    PropagationType: {
                        ToString: "Entity",
                    },
                    PermissionType: {
                        ToString: "Access",
                    },
                    SecurityPermission: {
                        ToString: "AllowAccess",
                    },
                },
                {
                    ToString: "Sitecore.Security.AccessControl.AccessRule",
                    AccessRight: {
                        ToString: "item:create",
                        Comment: "Create right for items.",
                        Name: "item:create",
                        Title: "Create",
                        IsFieldRight: false,
                        IsItemRight: true,
                        IsLanguageRight: false,
                        IsSiteRight: false,
                        IsWorkflowCommandRight: false,
                        IsWorkflowStateRight: false,
                        IsWildcard: false,
                        ModifiesData: true,
                    },
                    PropagationType: {
                        ToString: "Entity",
                    },
                    PermissionType: {
                        ToString: "Access",
                    },
                    SecurityPermission: {
                        ToString: "DenyAccess",
                    },
                },
                {
                    ToString: "Sitecore.Security.AccessControl.AccessRule",
                    AccessRight: {
                        ToString: "bucket:makebucket",
                        BucketFieldName: "",
                        Comment: "Create Bucket",
                        Name: "bucket:makebucket",
                        Title: "Create Bucket",
                        IsFieldRight: false,
                        IsItemRight: false,
                        IsLanguageRight: false,
                        IsSiteRight: false,
                        IsWorkflowCommandRight: false,
                        IsWorkflowStateRight: false,
                        IsWildcard: false,
                        ModifiesData: false,
                    },
                    PropagationType: {
                        ToString: "Entity",
                    },
                    PermissionType: {
                        ToString: "Access",
                    },
                    SecurityPermission: {
                        ToString: "AllowAccess",
                    },
                },
                {
                    ToString: "Sitecore.Security.AccessControl.AccessRule",
                    AccessRight: {
                        ToString: "bucket:unmake",
                        BucketFieldName: "",
                        Comment: "Revert Bucket",
                        Name: "bucket:unmake",
                        Title: "Revert Bucket",
                        IsFieldRight: false,
                        IsItemRight: false,
                        IsLanguageRight: false,
                        IsSiteRight: false,
                        IsWorkflowCommandRight: false,
                        IsWorkflowStateRight: false,
                        IsWildcard: false,
                        ModifiesData: false,
                    },
                    PropagationType: {
                        ToString: "Entity",
                    },
                    PermissionType: {
                        ToString: "Access",
                    },
                    SecurityPermission: {
                        ToString: "DenyAccess",
                    },
                },
                {
                    ToString: "Sitecore.Security.AccessControl.AccessRule",
                    AccessRight: {
                        ToString: "item:admin",
                        Comment: "Admin right for items.",
                        Name: "item:admin",
                        Title: "Administer",
                        IsFieldRight: false,
                        IsItemRight: true,
                        IsLanguageRight: false,
                        IsSiteRight: false,
                        IsWorkflowCommandRight: false,
                        IsWorkflowStateRight: false,
                        IsWildcard: false,
                        ModifiesData: true,
                    },
                    PropagationType: {
                        ToString: "Entity",
                    },
                    PermissionType: {
                        ToString: "Access",
                    },
                    SecurityPermission: {
                        ToString: "DenyAccess",
                    },
                },
                {
                    ToString: "Sitecore.Security.AccessControl.AccessRule",
                    AccessRight: {
                        ToString: "item:rename",
                        Comment: "Rename right for items.",
                        Name: "item:rename",
                        Title: "Rename",
                        IsFieldRight: false,
                        IsItemRight: true,
                        IsLanguageRight: false,
                        IsSiteRight: false,
                        IsWorkflowCommandRight: false,
                        IsWorkflowStateRight: false,
                        IsWildcard: false,
                        ModifiesData: true,
                    },
                    PropagationType: {
                        ToString: "Entity",
                    },
                    PermissionType: {
                        ToString: "Access",
                    },
                    SecurityPermission: {
                        ToString: "AllowAccess",
                    },
                },
                {
                    ToString: "Sitecore.Security.AccessControl.AccessRule",
                    AccessRight: {
                        ToString: "item:write",
                        Comment: "Write right for items.",
                        Name: "item:write",
                        Title: "Write",
                        IsFieldRight: false,
                        IsItemRight: true,
                        IsLanguageRight: false,
                        IsSiteRight: false,
                        IsWorkflowCommandRight: false,
                        IsWorkflowStateRight: false,
                        IsWildcard: false,
                        ModifiesData: true,
                    },
                    PropagationType: {
                        ToString: "Entity",
                    },
                    PermissionType: {
                        ToString: "Access",
                    },
                    SecurityPermission: {
                        ToString: "DenyAccess",
                    },
                },
                {
                    ToString: "Sitecore.Security.AccessControl.AccessRule",
                    Account: {
                        ToString: "Sitecore.Security.Accounts.Role",
                        Domain: expect.anything(),
                        IsEveryone: false,
                        IsGlobal: false,
                        AccountType: "Role",
                        Description: "Role",
                        DisplayName: "sitecore\\Developer",
                        LocalName: "sitecore\\Developer",
                        Name: "sitecore\\Developer",
                        Roles: [
                            "Sitecore.Security.Accounts.Role",
                            "Sitecore.Security.Accounts.Role",
                            "Sitecore.Security.Accounts.Role",
                            "Sitecore.Security.Accounts.Role",
                            "Sitecore.Security.Accounts.Role",
                            "Sitecore.Security.Accounts.Role",
                        ],
                        MemberOf: [
                            "Sitecore.Security.Accounts.Role",
                            "Sitecore.Security.Accounts.Role",
                            "Sitecore.Security.Accounts.Role",
                            "Sitecore.Security.Accounts.Role",
                            "Sitecore.Security.Accounts.Role",
                            "Sitecore.Security.Accounts.Role",
                        ],
                    },
                    PropagationType: {
                        ToString: "Descendants",
                    },
                    PermissionType: {
                        ToString: "Access",
                    },
                    SecurityPermission: {
                        ToString: "AllowAccess",
                    },
                },
                {
                    ToString: "Sitecore.Security.AccessControl.AccessRule",
                    PropagationType: {
                        ToString: "Descendants",
                    },
                    PermissionType: {
                        ToString: "Access",
                    },
                    SecurityPermission: {
                        ToString: "DenyAccess",
                    },
                },
                {
                    ToString: "Sitecore.Security.AccessControl.AccessRule",
                    PropagationType: {
                        ToString: "Descendants",
                    },
                    PermissionType: {
                        ToString: "Access",
                    },
                    SecurityPermission: {
                        ToString: "AllowAccess",
                    },
                },
                {
                    ToString: "Sitecore.Security.AccessControl.AccessRule",
                    PropagationType: {
                        ToString: "Descendants",
                    },
                    PermissionType: {
                        ToString: "Access",
                    },
                    SecurityPermission: {
                        ToString: "DenyAccess",
                    },
                },
                {
                    ToString: "Sitecore.Security.AccessControl.AccessRule",
                    PropagationType: {
                        ToString: "Descendants",
                    },
                    PermissionType: {
                        ToString: "Access",
                    },
                    SecurityPermission: {
                        ToString: "DenyAccess",
                    },
                },
                {
                    ToString: "Sitecore.Security.AccessControl.AccessRule",
                    PropagationType: {
                        ToString: "Descendants",
                    },
                    PermissionType: {
                        ToString: "Access",
                    },
                    SecurityPermission: {
                        ToString: "AllowAccess",
                    },
                },
                {
                    ToString: "Sitecore.Security.AccessControl.AccessRule",
                    PropagationType: {
                        ToString: "Descendants",
                    },
                    PermissionType: {
                        ToString: "Access",
                    },
                    SecurityPermission: {
                        ToString: "DenyAccess",
                    },
                },
                {
                    ToString: "Sitecore.Security.AccessControl.AccessRule",
                    AccessRight: {
                        ToString: "item:read",
                        Comment: "Read right for items.",
                        Name: "item:read",
                        Title: "Read",
                        IsFieldRight: false,
                        IsItemRight: true,
                        IsLanguageRight: false,
                        IsSiteRight: false,
                        IsWorkflowCommandRight: false,
                        IsWorkflowStateRight: false,
                        IsWildcard: false,
                        ModifiesData: false,
                    },
                    PropagationType: {
                        ToString: "Entity",
                    },
                    PermissionType: {
                        ToString: "Access",
                    },
                    SecurityPermission: {
                        ToString: "AllowAccess",
                    },
                },
            ],
        });
    });
});