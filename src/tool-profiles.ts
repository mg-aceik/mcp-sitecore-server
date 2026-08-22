import type { McpServer } from "@modelcontextprotocol/server";

/**
 * Tool gating: which of the server's 117 tools get registered.
 *
 * (117 is the count with the default `GRAPHQL_SCHEMAS=edge,master`: the GraphQL group
 * registers a query and an introspection tool per schema, so the total moves with that
 * setting. Everything else is fixed.)
 *
 * Schema cost is paid on every turn whether a tool is ever called or not, so a client
 * that only needs part of the surface should be able to say so. Three optional
 * environment variables, all unset by default:
 *
 * - `TOOL_GROUPS`   — allowlist of groups to register (the directory layout, see below).
 * - `DISABLED_TOOLS`— denylist of exact tool names.
 * - `TOOL_PROFILE`  — a documented preset denylist for a platform.
 *
 * Unset means register everything, so none of this is a breaking change, and the
 * denylist always wins on conflict.
 *
 * **No tool is denied by default.** This server targets SitecoreAI *and* XM/XP, and what
 * is dead weight on one is essential on the other: CM-side identity management is core
 * workflow on XP but lives in the Sitecore Cloud Portal on SitecoreAI.
 */

/**
 * The registrable groups. These are the directory layout under `src/tools/`, not a new
 * taxonomy — `powershell.provider` is the `provider` folder under both
 * `src/tools/powershell/simple` and `src/tools/powershell/composite`, and so on.
 *
 * `powershell.core` is the pair of tools that sit directly under
 * `src/tools/powershell/` rather than in a category folder:
 * `get-powershell-documentation` and `run-powershell-script`.
 *
 * `powershell.composition` is the site-aware composition set added in Tier 1
 * (`composite/composition/`). It is its own group rather than part of
 * `powershell.presentation` because the two answer different questions and are wanted at
 * different times: `powershell.presentation` is the thin SPE wrapper set that writes what
 * it is told, while `powershell.composition` is the site-scoped layer that reads
 * placeholder settings, datasource locations and available renderings in order to refuse
 * an invalid layout. A client that only reads a page's structure wants the first; an agent
 * authoring pages wants the second, and paying for both when it needs one is the cost this
 * grouping exists to avoid.
 */
export const TOOL_GROUPS = [
    "graphql",
    "item-service",
    "powershell.core",
    "powershell.composition",
    "powershell.security",
    "powershell.common",
    "powershell.presentation",
    "powershell.logging",
    "powershell.provider",
    "powershell.indexing",
    "powershell.media",
    "sitecore-cli",
] as const;

export type ToolGroup = (typeof TOOL_GROUPS)[number];

export type ToolProfile = {
    /** Why this profile exists, and what it assumes about the platform. */
    description: string;
    /** Whole groups the profile hides, with the reason. */
    disabledGroups: Partial<Record<ToolGroup, string>>;
    /** Individual tools the profile hides, with the reason. */
    disabledTools: Record<string, string>;
};

/**
 * The preset denylists. Keep every profile in this table — `register.ts` must stay a
 * list of registrars, so that a platform team can read what a profile hides, and why,
 * in one place.
 */
export const TOOL_PROFILES: Record<string, ToolProfile> = {
    xp: {
        description:
            "Sitecore XM/XP on-premise or IaaS. Disables nothing: publishing, application "
            + "restart and CM-side identity management are all real operations on XP.",
        disabledGroups: {},
        disabledTools: {},
    },
    sai: {
        description:
            "SitecoreAI (SAI). Hides the CM-side identity tools, which are misleading on a "
            + "platform where users and roles live in the Sitecore Cloud Portal. Publishing "
            + "and application restart stay available: on SitecoreAI content publishes to "
            + "Edge, which lives on Sitecore's cloud servers only (there is no web database), "
            + "so common-publish-item works on deployed environments even though a local "
            + "development CM has no publishing target.",
        disabledGroups: {
            "powershell.security":
                "Users, roles and domains are managed in the Sitecore Cloud Portal, not on the "
                + "CM, so the CM-side identity tools are misleading at best. This also hides the "
                + "item ACL, lock and protect tools, which do work on a SitecoreAI CM — use "
                + "TOOL_PROFILE=xp with DISABLED_TOOLS if you need those.",
        },
        disabledTools: {},
    },
};

export type ToolGating = {
    /** Allowlisted groups, or null when `TOOL_GROUPS` is unset (register everything). */
    enabledGroups: Set<string> | null;
    /** Groups hidden by the active profile. */
    disabledGroups: Set<string>;
    /** Tool names hidden by the active profile or by `DISABLED_TOOLS`. */
    disabledTools: Set<string>;
    /**
     * The denylisted names that actually matched a tool. A name that never matches is a
     * typo, and a typo in a denylist fails open — the tool the operator meant to hide
     * stays registered. `reportUnmatchedTools` says so once registration is done, which is
     * the earliest point at which the full set of names is known.
     */
    matchedTools: Set<string>;
};

function splitList(value: string | undefined): string[] {
    return (value ?? "")
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry !== "");
}

/**
 * Reads the gating environment variables. Unknown group or profile names are reported on
 * stderr and ignored rather than thrown, because a typo in a client's MCP config should
 * not stop the server from starting (and on stdio there is nowhere else to complain).
 */
export function resolveToolGating(env: NodeJS.ProcessEnv = process.env): ToolGating {
    const requestedGroups = splitList(env.TOOL_GROUPS);
    const known = new Set<string>(TOOL_GROUPS);
    const recognisedGroups = requestedGroups.filter((group) => known.has(group));
    for (const group of requestedGroups) {
        if (!known.has(group)) {
            console.error(
                `TOOL_GROUPS: unknown group '${group}'. Known groups: ${TOOL_GROUPS.join(", ")}.`
            );
        }
    }
    // Unknown names are dropped rather than kept, so an allowlist of nothing but typos
    // behaves as if TOOL_GROUPS were unset instead of registering zero tools in silence.
    if (requestedGroups.length > 0 && recognisedGroups.length === 0) {
        console.error(
            "TOOL_GROUPS: no recognised group names, so the allowlist is being ignored and every "
            + "group is registered. Fix the names to narrow the surface."
        );
    }

    const profileName = (env.TOOL_PROFILE ?? "").trim().toLowerCase();
    const profile = profileName ? TOOL_PROFILES[profileName] : undefined;
    if (profileName && !profile) {
        console.error(
            `TOOL_PROFILE: unknown profile '${profileName}'. Known profiles: `
            + `${Object.keys(TOOL_PROFILES).join(", ")}. No profile applied.`
        );
    }

    return {
        enabledGroups: recognisedGroups.length > 0 ? new Set(recognisedGroups) : null,
        disabledGroups: new Set(Object.keys(profile?.disabledGroups ?? {})),
        disabledTools: new Set([
            ...Object.keys(profile?.disabledTools ?? {}),
            ...splitList(env.DISABLED_TOOLS),
        ]),
        matchedTools: new Set<string>(),
    };
}

/**
 * Reports denylisted tool names that never matched anything registered.
 *
 * Group names are validated when they are read; tool names cannot be, because the full
 * set only exists once the registrars have run. Without this, `DISABLED_TOOLS=media-uplod`
 * silently leaves `media-upload` registered — a denylist that fails open and says nothing.
 */
const reportedUnmatched = new Set<string>();

export function reportUnmatchedTools(gating: ToolGating): string[] {
    const unmatched = [...gating.disabledTools].filter((name) => !gating.matchedTools.has(name));
    // The HTTP transport builds a server per request, so report each name once per process
    // rather than once per exchange.
    const fresh = unmatched.filter((name) => !reportedUnmatched.has(name));
    fresh.forEach((name) => reportedUnmatched.add(name));
    if (fresh.length > 0) {
        console.error(
            `DISABLED_TOOLS: no tool is named ${fresh.map((n) => `'${n}'`).join(", ")}, so `
            + `nothing was hidden for ${fresh.length === 1 ? "it" : "them"}. Check the `
            + `spelling against the tool list; a group may also have excluded it already.`
        );
    }
    return unmatched;
}

/** Test seam: forget which unmatched names have already been reported. */
export function resetUnmatchedToolReporting(): void {
    reportedUnmatched.clear();
}

export function isGroupEnabled(group: string, gating: ToolGating): boolean {
    if (gating.disabledGroups.has(group)) {
        return false;
    }
    return gating.enabledGroups === null || gating.enabledGroups.has(group);
}

export function isToolEnabled(name: string, gating: ToolGating): boolean {
    return !gating.disabledTools.has(name);
}

/**
 * The handle `registerTool` hands back for a tool that was denied.
 *
 * Returning `undefined` would make a denylist entry turn any caller that chains off the
 * registration — `.disable()`, `.update()` — into a TypeError, so gating would break code
 * that works with gating off. An inert handle keeps the call sites uniform.
 */
function deniedToolHandle() {
    const noop = () => undefined;
    return { enabled: false, enable: noop, disable: noop, update: noop, remove: noop };
}

/**
 * Patches `server.registerTool` so that a denylisted tool is silently not registered.
 *
 * Filtering here rather than at each call site means `DISABLED_TOOLS` covers every tool
 * in the server, including the ones a single registrar function registers several of.
 * The group allowlist is applied in `register.ts`, which skips whole registrar sets and
 * so also skips their startup cost.
 *
 * The patch is installed unconditionally: it is also what records which denylist names
 * matched, and `reportUnmatchedTools` needs that even when the current call happens to
 * have an empty denylist.
 */
export function withToolGating(server: McpServer, gating: ToolGating): McpServer {
    const originalRegisterTool = server.registerTool.bind(server) as (...args: any[]) => any;

    (server as any).registerTool = (name: string, config: Record<string, any>, cb: any) => {
        if (!isToolEnabled(name, gating)) {
            gating.matchedTools.add(name);
            return deniedToolHandle();
        }
        return originalRegisterTool(name, config, cb);
    };

    return server;
}
