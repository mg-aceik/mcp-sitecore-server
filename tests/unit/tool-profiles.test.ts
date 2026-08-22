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
        expect(isToolEnabled("common-publish-item-by-path", gating)).toBe(true);
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
        expect(isToolEnabled("provider-get-item-by-path", gating)).toBe(true);
        // A denylist alone must not turn into an allowlist.
        expect(gating.enabledGroups).toBeNull();
    });

    it("applies the xmcloud profile", () => {
        const gating = resolveToolGating({ TOOL_PROFILE: "xmcloud" });
        expect(isToolEnabled("common-publish-item-by-id", gating)).toBe(false);
        expect(isToolEnabled("common-publish-item-by-path", gating)).toBe(false);
        expect(isToolEnabled("common-restart-application", gating)).toBe(false);
        expect(isGroupEnabled("powershell.security", gating)).toBe(false);
        // Everything else stays.
        expect(isGroupEnabled("powershell.common", gating)).toBe(true);
        expect(isToolEnabled("provider-get-item-by-path", gating)).toBe(true);
    });

    it("applies the xp profile as a no-op, matching the unset default", () => {
        const gating = resolveToolGating({ TOOL_PROFILE: "xp" });
        expect(gating.disabledGroups.size).toBe(0);
        expect(gating.disabledTools.size).toBe(0);
    });

    it("unions DISABLED_TOOLS on top of the profile", () => {
        const gating = resolveToolGating({ TOOL_PROFILE: "xmcloud", DISABLED_TOOLS: "indexing-find-item" });
        expect(isToolEnabled("indexing-find-item", gating)).toBe(false);
        expect(isToolEnabled("common-restart-application", gating)).toBe(false);
    });

    it("lets the denylist win over the group allowlist", () => {
        const gating = resolveToolGating({
            TOOL_GROUPS: "powershell.provider",
            DISABLED_TOOLS: "provider-get-item-by-uri",
        });
        expect(isGroupEnabled("powershell.provider", gating)).toBe(true);
        expect(isToolEnabled("provider-get-item-by-uri", gating)).toBe(false);
    });

    it("ignores an unknown profile rather than failing to start", () => {
        const gating = resolveToolGating({ TOOL_PROFILE: "xm-cloud-typo" });
        expect(gating.disabledTools.size).toBe(0);
        expect(gating.disabledGroups.size).toBe(0);
    });

    it("is case-insensitive about the profile name", () => {
        expect(resolveToolGating({ TOOL_PROFILE: "XmCloud" }).disabledTools.size).toBeGreaterThan(0);
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
