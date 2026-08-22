import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../../client";
import e from "express";

await client.connect(transport);

describe("powershell", () => {
    it("security-new-user", async () => {

        const randomHexSuffix = Math.floor(Math.random() * 1000000).toString(16);
        const args: Record<string, string> = {
            identity: `anton-${randomHexSuffix}`,
            password: "anton",
            email: "at@exdst.com",
            fullName: "Anton Tishehnko",
            comment: "Anton Tishehnko",
            portrait: "office/16x16/default_user.png",
            enabled: "true",
            profileItemId: "{AE4C4969-5B7E-4B4E-9042-B2D8701CE214}",
        };
        const result = await callTool(client, "security-new-user", args);
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
                      Comment: "Anton Tishehnko",
                      ContentLanguage: "",
                      Email: "at@exdst.com",
                      FullName: "Anton Tishehnko",
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
                      UserName: `sitecore\\anton-${randomHexSuffix}`,
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
                        En: [
                          {
                            Key: "digestcredentialhash",
                            Value: expect.any(String),
                          },
                          {
                            Key: "digestcredentialhashwithoutdomain",
                            Value: expect.any(String),
                          },
                        ],
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
                      PropertyValues: [
                        "System.Configuration.SettingsPropertyValue",
                        "System.Configuration.SettingsPropertyValue",
                        "System.Configuration.SettingsPropertyValue",
                        "System.Configuration.SettingsPropertyValue",
                        "System.Configuration.SettingsPropertyValue",
                        "System.Configuration.SettingsPropertyValue",
                        "System.Configuration.SettingsPropertyValue",
                        "System.Configuration.SettingsPropertyValue",
                        "System.Configuration.SettingsPropertyValue",
                        "System.Configuration.SettingsPropertyValue",
                        "System.Configuration.SettingsPropertyValue",
                        "System.Configuration.SettingsPropertyValue",
                        "System.Configuration.SettingsPropertyValue",
                        "System.Configuration.SettingsPropertyValue",
                        "System.Configuration.SettingsPropertyValue",
                        "System.Configuration.SettingsPropertyValue",
                        "System.Configuration.SettingsPropertyValue",
                        "System.Configuration.SettingsPropertyValue",
                        "System.Configuration.SettingsPropertyValue",
                        "System.Configuration.SettingsPropertyValue",
                        "System.Configuration.SettingsPropertyValue",
                        "System.Configuration.SettingsPropertyValue",
                        "System.Configuration.SettingsPropertyValue",
                      ],
                      Context: {
                        En: [
                          {
                            Key: "UserName",
                            Value: `sitecore\\anton-${randomHexSuffix}`,
                          },
                          {
                            Key: "IsAuthenticated",
                            Value: true,
                          },
                        ],
                      },
                      IsAdministrator: false,
                      IsAnonymous: false,
                      IsDirty: true,
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
                      Name: `sitecore\\anton-${randomHexSuffix}`,
                      IsAuthenticated: true,
                    },
                    AccountType: {
                      ToString: "User",
                    },
                    IsAdministrator: false,
                    IsAuthenticated: true,
                    LocalName: `anton-${randomHexSuffix}`,
                    Description: "User",
                    DisplayName: `sitecore\\anton-${randomHexSuffix}`,
                    Name: `sitecore\\anton-${randomHexSuffix}`,
                    IsEnabled: true,
                  },
                ],
              }
        );

        const removeUserArgs: Record<string, string> = {
            identity: `sitecore\\anton-${randomHexSuffix}`,
        };

        const removeUserResult = await callTool(client, "security-remove-user", removeUserArgs);
        const removeUserJson = JSON.parse(removeUserResult.content[0].text);
    });
});