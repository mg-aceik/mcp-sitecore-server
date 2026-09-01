import { describe, it, expect } from "vitest";
import {
    TOOL_GROUPS,
    TOOL_PROFILES,
    isGroupEnabled,
    isToolEnabled,
    resolveToolGating,
} from "../../src/tool-profiles";

describe("resolveToolGating", () => {
    it("registers everything when nothing is set", () => {
        const gating = resolveToolGating({});
        expect(gating.enabledGroups).toBeNull();
        expect(gating.disabledGroups.size).toBe(0);
        expect(gating.disabledTools.size).toBe(0);
        for (const group of TOOL_GROUPS) {
            expect(isGroupEnabled(group, gating)).toBe(true);
        }
        expect(isToolEnabled("common-publish-item", gating)).toBe(true);
    });

    it("limits registration to the named groups", () => {
        const gating = resolveToolGating({ TOOL_GROUPS: "powershell.provider, graphql" });
        expect(isGroupEnabled("powershell.provider", gating)).toBe(true);
        expect(isGroupEnabled("graphql", gating)).toBe(true);
        expect(isGroupEnabled("powershell.security", gating)).toBe(false);
        expect(isGroupEnabled("item-service", gating)).toBe(false);
    });

    it("denies exact tool names", () => {
        const gating = resolveToolGating({ DISABLED_TOOLS: "indexing-find-item, run-powershell-script" });
        expect(isToolEnabled("indexing-find-item", gating)).toBe(false);
        expect(isToolEnabled("run-powershell-script", gating)).toBe(false);
        expect(isToolEnabled("provider-get-item", gating)).toBe(true);
        // A denylist alone must not turn into an allowlist.
        expect(gating.enabledGroups).toBeNull();
    });

    it("applies the no-account-management profile", () => {
        const gating = resolveToolGating({ TOOL_PROFILE: "no-account-management" });
        // A policy profile, not a capability one: these tools work on any CM, and the
        // deployment is declining to put them within an agent's reach.
        expect(isToolEnabled("security-new-user", gating)).toBe(false);
        expect(isToolEnabled("security-set-user-password", gating)).toBe(false);
        expect(isToolEnabled("security-new-domain", gating)).toBe(false);
        expect(isToolEnabled("security-export-account", gating)).toBe(false);
        // The group itself is *not* hidden: item security is set from the CM on every
        // platform, and reading an account changes nothing and is needed to name an
        // identity in an access rule.
        expect(isGroupEnabled("powershell.security", gating)).toBe(true);
        expect(isToolEnabled("security-set-item-acl", gating)).toBe(true);
        expect(isToolEnabled("security-get-item-acl", gating)).toBe(true);
        expect(isToolEnabled("security-test-item-acl", gating)).toBe(true);
        expect(isToolEnabled("security-set-item-lock", gating)).toBe(true);
        expect(isToolEnabled("security-set-item-protection", gating)).toBe(true);
        expect(isToolEnabled("security-get-user", gating)).toBe(true);
        expect(isToolEnabled("security-get-role", gating)).toBe(true);
        // This profile is about accounts and nothing else: every other group is untouched.
        expect(isGroupEnabled("powershell.logging", gating)).toBe(true);
        expect(isToolEnabled("logging-get-logs", gating)).toBe(true);
        expect(isToolEnabled("common-publish-item", gating)).toBe(true);
        expect(isToolEnabled("common-restart-application", gating)).toBe(true);
        expect(isGroupEnabled("powershell.common", gating)).toBe(true);
        expect(isToolEnabled("provider-get-item", gating)).toBe(true);
        expect(isGroupEnabled("authoring.core", gating)).toBe(true);
        expect(isGroupEnabled("authoring.content", gating)).toBe(true);
        expect(isGroupEnabled("authoring.management", gating)).toBe(true);
        // It hides exactly the twelve tools it documents, and no group at all.
        expect(gating.disabledGroups.size).toBe(0);
        expect(gating.disabledTools.size).toBe(12);
    });

    it("names only absences and withheld operations, never a platform", () => {
        // Every profile is a `no-*` entry: a preset keyed to a Sitecore product would have
        // to guess which tools that product's operators do not want, and this is the guard
        // against one being added on the quiet.
        for (const name of Object.keys(TOOL_PROFILES)) {
            expect(name.startsWith("no-")).toBe(true);
        }
    });

    it("no longer accepts the removed sitecore-cli group", () => {
        // The group and its one tool were removed: Sitecore's own documentation MCP server
        // answers the same questions against docs that are actually current.
        expect(TOOL_GROUPS as readonly string[]).not.toContain("sitecore-cli");
        const gating = resolveToolGating({ TOOL_GROUPS: "sitecore-cli" });
        // An allowlist of nothing but unknown names is ignored rather than registering zero
        // tools, so this behaves as if TOOL_GROUPS were unset.
        expect(gating.enabledGroups).toBeNull();
    });

    it("unions DISABLED_TOOLS on top of the profile", () => {
        const gating = resolveToolGating({
            TOOL_PROFILE: "no-account-management",
            DISABLED_TOOLS: "indexing-find-item",
        });
        expect(isToolEnabled("indexing-find-item", gating)).toBe(false);
        expect(isToolEnabled("security-new-user", gating)).toBe(false);
    });

    it("lets the denylist win over the group allowlist", () => {
        const gating = resolveToolGating({
            TOOL_GROUPS: "powershell.provider",
            DISABLED_TOOLS: "provider-get-item",
        });
        expect(isGroupEnabled("powershell.provider", gating)).toBe(true);
        expect(isToolEnabled("provider-get-item", gating)).toBe(false);
    });

    it("ignores an unknown profile rather than failing to start", () => {
        const gating = resolveToolGating({ TOOL_PROFILE: "no-account-managment" });
        expect(gating.disabledTools.size).toBe(0);
        expect(gating.disabledGroups.size).toBe(0);
    });

    it("is case-insensitive about the profile name", () => {
        expect(resolveToolGating({ TOOL_PROFILE: "NO-ACCOUNT-MANAGEMENT" }).disabledTools.size)
            .toBeGreaterThan(0);
    });

    it("hides every powershell group under no-spe, and nothing else", () => {
        const gating = resolveToolGating({ TOOL_PROFILE: "no-spe" });
        for (const group of TOOL_GROUPS) {
            expect(isGroupEnabled(group, gating)).toBe(group.startsWith("powershell.") === false);
        }
        // The point of the profile: the tools that cannot run without the remoting service
        // are gone, and the three surfaces that do not touch SPE are untouched.
        expect(isGroupEnabled("powershell.core", gating)).toBe(false);
        expect(isGroupEnabled("item-service", gating)).toBe(true);
        expect(isGroupEnabled("graphql", gating)).toBe(true);
        expect(isGroupEnabled("authoring.content", gating)).toBe(true);
    });

    it("hides only the item-service group under no-item-service", () => {
        const gating = resolveToolGating({ TOOL_PROFILE: "no-item-service" });
        expect(isGroupEnabled("item-service", gating)).toBe(false);
        // Items stay reachable by the other two routes, which is why this profile is safe
        // to set on its own.
        expect(isGroupEnabled("authoring.content", gating)).toBe(true);
        expect(isGroupEnabled("powershell.provider", gating)).toBe(true);
    });

    it("hides only the delivery-side graphql group under no-edge-graphql", () => {
        const gating = resolveToolGating({ TOOL_PROFILE: "no-edge-graphql" });
        expect(isGroupEnabled("graphql", gating)).toBe(false);
        // The Authoring and Management API is a different endpoint with different
        // credentials, so it must survive a profile aimed at Edge.
        expect(isGroupEnabled("authoring.core", gating)).toBe(true);
        expect(isGroupEnabled("authoring.content", gating)).toBe(true);
        expect(isGroupEnabled("authoring.management", gating)).toBe(true);
    });

    it("hides all three authoring groups under no-authoring-api", () => {
        const gating = resolveToolGating({ TOOL_PROFILE: "no-authoring-api" });
        expect(isGroupEnabled("authoring.core", gating)).toBe(false);
        expect(isGroupEnabled("authoring.content", gating)).toBe(false);
        expect(isGroupEnabled("authoring.management", gating)).toBe(false);
        // And not the Edge endpoints, which share nothing with it.
        expect(isGroupEnabled("graphql", gating)).toBe(true);
    });

    it("unions a comma-separated list of profiles", () => {
        // The headless case: no SPE remoting and no Item Service on the same instance.
        const gating = resolveToolGating({ TOOL_PROFILE: "no-spe, no-item-service" });
        expect(isGroupEnabled("powershell.common", gating)).toBe(false);
        expect(isGroupEnabled("item-service", gating)).toBe(false);
        expect(isGroupEnabled("graphql", gating)).toBe(true);
        expect(isGroupEnabled("authoring.content", gating)).toBe(true);
    });

    it("keeps the recognised profiles when one name in the list is a typo", () => {
        const gating = resolveToolGating({ TOOL_PROFILE: "no-spe,no-item-services" });
        expect(isGroupEnabled("powershell.common", gating)).toBe(false);
        // The typo hides nothing rather than taking the whole list down with it.
        expect(isGroupEnabled("item-service", gating)).toBe(true);
    });

    it("composes an operation profile with a surface profile", () => {
        const gating = resolveToolGating({ TOOL_PROFILE: "no-account-management,no-spe" });
        // no-account-management's tools all live in a group no-spe hides outright, and
        // hiding a tool twice is still just hiding it.
        expect(isGroupEnabled("powershell.security", gating)).toBe(false);
        expect(isToolEnabled("security-new-user", gating)).toBe(false);
        expect(isGroupEnabled("powershell.logging", gating)).toBe(false);
        expect(isGroupEnabled("powershell.media", gating)).toBe(false);
        expect(isGroupEnabled("authoring.content", gating)).toBe(true);
    });
});

describe("TOOL_PROFILES", () => {
    it("documents a reason for every entry, so a platform team can read what is hidden and why", () => {
        for (const profile of Object.values(TOOL_PROFILES)) {
            expect(profile.description.length).toBeGreaterThan(0);
            for (const reason of [...Object.values(profile.disabledGroups), ...Object.values(profile.disabledTools)]) {
                expect(reason.length).toBeGreaterThan(0);
            }
        }
    });

    it("only names groups that exist", () => {
        const known = new Set<string>(TOOL_GROUPS);
        for (const profile of Object.values(TOOL_PROFILES)) {
            for (const group of Object.keys(profile.disabledGroups)) {
                expect(known).toContain(group);
            }
        }
    });
});
