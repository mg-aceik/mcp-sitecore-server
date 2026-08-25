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

    it("applies the sai profile", () => {
        const gating = resolveToolGating({ TOOL_PROFILE: "sai" });
        expect(isGroupEnabled("powershell.security", gating)).toBe(false);
        // logging-get-logs reads log files from the CM's data folder, which a deployed
        // SitecoreAI environment does not serve — the platform collects the logs instead.
        expect(isGroupEnabled("powershell.logging", gating)).toBe(false);
        // Everything else stays — publishing targets Edge on SitecoreAI, so
        // common-publish-item and common-restart-application remain available.
        expect(isToolEnabled("common-publish-item", gating)).toBe(true);
        expect(isToolEnabled("common-restart-application", gating)).toBe(true);
        expect(isGroupEnabled("powershell.common", gating)).toBe(true);
        expect(isToolEnabled("provider-get-item", gating)).toBe(true);
        // The authoring surface is the preferred one on SitecoreAI, so none of it is hidden.
        expect(isGroupEnabled("authoring.core", gating)).toBe(true);
        expect(isGroupEnabled("authoring.content", gating)).toBe(true);
        expect(isGroupEnabled("authoring.management", gating)).toBe(true);
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

    it("applies the xp profile as a no-op, matching the unset default", () => {
        const gating = resolveToolGating({ TOOL_PROFILE: "xp" });
        expect(gating.disabledGroups.size).toBe(0);
        expect(gating.disabledTools.size).toBe(0);
    });

    it("unions DISABLED_TOOLS on top of the profile", () => {
        const gating = resolveToolGating({ TOOL_PROFILE: "sai", DISABLED_TOOLS: "indexing-find-item" });
        expect(isToolEnabled("indexing-find-item", gating)).toBe(false);
        expect(isGroupEnabled("powershell.security", gating)).toBe(false);
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
        const gating = resolveToolGating({ TOOL_PROFILE: "sai-typo" });
        expect(gating.disabledTools.size).toBe(0);
        expect(gating.disabledGroups.size).toBe(0);
    });

    it("is case-insensitive about the profile name", () => {
        expect(resolveToolGating({ TOOL_PROFILE: "SAI" }).disabledGroups.size).toBeGreaterThan(0);
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

    it("composes a platform profile with a surface profile", () => {
        const gating = resolveToolGating({ TOOL_PROFILE: "sai,no-spe" });
        // sai's own entries are a subset of no-spe's here, and hiding a group twice is
        // still just hiding it.
        expect(isGroupEnabled("powershell.security", gating)).toBe(false);
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
