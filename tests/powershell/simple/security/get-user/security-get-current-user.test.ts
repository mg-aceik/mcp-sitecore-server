import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("security-get-current-user", async () => {

        const result = await callTool(client, "security-get-current-user", {});
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
                            ToString: "sitecore",
                            AccountNameValidation: "^\\w[\\w\\s\\.\\@\\-]*$",
                            AccountPrefix: "sitecore\\",
                            AnonymousUserEmailPattern: "",
                            AnonymousUserName: "sitecore\\Anonymous",
                            Appearance: expect.anything(),
                            EveryoneRoleName: "sitecore\\Everyone",
                            MemberPattern: "sitecore\\*",
                            Name: "sitecore",
                            EnsureAnonymousUser: false,
                            IsDefault: false,
                            LocallyManaged: false,
                            DefaultProfileItemID: "",
                        },
                        Profile: {
                            ToString: "Sitecore.Security.UserProfile",
                            ClientLanguage: "",
                            Comment: "Sitecore Administrator",
                            ContentLanguage: "",
                            Email: "",
                            FullName: "Administrator",
                            Icon: "",
                            LegacyPassword: "",
                            ManagedDomainNames: "",
                            Notifications: "",
                            EngagementValue: "",
                            CurrentPosition: "",
                            Badges: "",
                            Name: "",
                            Portrait: "office/16x16/default_user.png",
                            ProfileItemId: "{AE4C4969-5B7E-4B4E-9042-B2D8701CE214}",
                            ProfileUser: "Sitecore.Security.Accounts.User",
                            RegionalIsoCode: "",
                            StartUrl: "",
                            State: "",
                            UserName: "sitecore\\admin",
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
                            SerializedData: expect.anything(),
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
                                        Value: "sitecore\\admin",
                                    },
                                    {
                                        Key: "IsAuthenticated",
                                        Value: true,
                                    },
                                ],
                            },
                            IsAdministrator: true,
                            IsAnonymous: false,
                            IsDirty: expect.any(Boolean),
                            IsSynchronized: false,
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
                            Name: "sitecore\\admin",
                            IsAuthenticated: true,
                        },
                        AccountType: {
                            ToString: "User",
                        },
                        IsAdministrator: true,
                        IsAuthenticated: true,
                        LocalName: "admin",
                        Description: "User",
                        DisplayName: "sitecore\\admin",
                        Name: "sitecore\\admin",
                        IsEnabled: true,
                    },
                ],
            }
        );
    });
});