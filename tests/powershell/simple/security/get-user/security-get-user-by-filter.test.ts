import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../../client";
import e from "express";

await client.connect(transport);

describe("powershell", () => {
    it("security-get-user-by-filter", async () => {
        const args: Record<string, string> = {
            filter: "extranet\*",
        };
        const result = await callTool(client, "security-get-user-by-filter", args);
        const json = JSON.parse(result.content[0].text);

        expect(json).toMatchObject(
            {
                Obj: [
                    {
                        ToString: "Sitecore.Security.Accounts.User",
                        Delegation: {
                            ToString: "Sitecore.Security.Accounts.UserDelegation",
                        },
                        Domain: {
                            ToString: "extranet",
                            AccountNameValidation: "^\\w[\\w\\s\\.\\@\\-]*$",
                            AccountPrefix: "extranet\\",
                            AnonymousUserEmailPattern: "",
                            AnonymousUserName: "extranet\\Anonymous",
                            Appearance: expect.anything(),
                            EveryoneRoleName: "extranet\\Everyone",
                            MemberPattern: "extranet\\*",
                            Name: "extranet",
                            EnsureAnonymousUser: true,
                            IsDefault: false,
                            LocallyManaged: false,
                            DefaultProfileItemID: "",
                        },
                        Profile: {
                            ToString: "Sitecore.Security.UserProfile",
                            ClientLanguage: "",
                            Comment: "",
                            ContentLanguage: "",
                            Email: "",
                            FullName: "",
                            Icon: "",
                            LegacyPassword: "",
                            ManagedDomainNames: "",
                            Notifications: "",
                            EngagementValue: "",
                            CurrentPosition: "",
                            Badges: "",
                            Name: "",
                            Portrait: "office/16x16/default_user.png",
                            ProfileUser: "Sitecore.Security.Accounts.User",
                            RegionalIsoCode: "",
                            StartUrl: "",
                            State: "",
                            UserName: "extranet\\Anonymous",
                            Culture: {
                                ToString: "en-US",
                                LCID: 1033,
                                Name: "en-US",
                                DisplayName: "English (United States)",
                                IetfLanguageTag: "en-US",
                                ThreeLetterISOLanguageName: "eng",
                                ThreeLetterWindowsLanguageName: "ENU",
                                TwoLetterISOLanguageName: "en",
                            },
                            SerializedData: {
                            },
                            Properties: [
                                "System.Configuration.SettingsProperty",
                                "System.Configuration.SettingsProperty",
                                "System.Configuration.SettingsProperty",
                                "System.Configuration.SettingsProperty",
                                "System.Configuration.SettingsProperty",
                                "System.Configuration.SettingsProperty",
                                "System.Configuration.SettingsProperty",
                                "System.Configuration.SettingsProperty",
                                "System.Configuration.SettingsProperty",
                                "System.Configuration.SettingsProperty",
                                "System.Configuration.SettingsProperty",
                                "System.Configuration.SettingsProperty",
                                "System.Configuration.SettingsProperty",
                                "System.Configuration.SettingsProperty",
                                "System.Configuration.SettingsProperty",
                                "System.Configuration.SettingsProperty",
                                "System.Configuration.SettingsProperty",
                                "System.Configuration.SettingsProperty",
                                "System.Configuration.SettingsProperty",
                                "System.Configuration.SettingsProperty",
                                "System.Configuration.SettingsProperty",
                                "System.Configuration.SettingsProperty",
                                "System.Configuration.SettingsProperty",
                            ],
                            Providers: [
                                "Sitecore.Security.DisabledProfileProvider",
                                "System.Web.Profile.SqlProfileProvider",
                                "Sitecore.Security.SwitchingProfileProvider",
                            ],
                            PropertyValues: expect.any(Array),
                            Context: {
                                En: [
                                    {
                                        Key: "UserName",
                                        Value: "extranet\\Anonymous",
                                    },
                                    {
                                        Key: "IsAuthenticated",
                                        Value: false,
                                    },
                                ],
                            },
                            IsAdministrator: false,
                            IsAnonymous: true,
                            IsDirty: expect.any(Boolean),
                            IsSynchronized: false,
                            ProfileItemId: "",
                            LastActivityDate: expect.any(String),
                            LastUpdatedDate: expect.any(String),
                        },
                        Roles: {
                        },
                        RuntimeSettings: {
                            ToString: "Sitecore.SecurityModel.UserRuntimeSettings",
                            Properties: {
                            },
                            AddedRoles: [
                            ],
                            RemovedRoles: [
                            ],
                            IsAdministrator: false,
                            IsVirtual: false,
                        },
                        Identity: {
                            ToString: "Sitecore.Security.Principal.SitecoreIdentity",
                            AuthenticationType: "",
                            Name: "extranet\\Anonymous",
                            IsAuthenticated: false,
                        },
                        AccountType: {
                            ToString: "User",
                        },
                        IsAdministrator: false,
                        IsAuthenticated: false,
                        LocalName: "Anonymous",
                        Description: "User",
                        DisplayName: "extranet\\Anonymous",
                        Name: "extranet\\Anonymous",
                        IsEnabled: true,
                    },
                ],
            }
        );
    });
});