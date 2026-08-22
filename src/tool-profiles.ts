import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Tool gating: which of the server's ~115 tools get registered.
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
 * **No tool is denied by default.** This server targets XM Cloud *and* XM/XP, and what
 * is dead weight on one is essential on the other: the publish tools cannot work against
 * an XM Cloud CM, which has no `web` database, but they are core workflow on XP.
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
    xmcloud: {
        description:
            "Sitecore XM Cloud. Hides the tools that cannot work against an XM Cloud CM, or "
            + "that an agent should never reach for there by accident.",
        disabledGroups: {
            "powershell.security":
                "Users, roles and domains are managed in the Sitecore Cloud Portal, not on the "
                + "CM, so the CM-side identity tools are misleading at best. This also hides the "
                + "item ACL, lock and protect tools, which do work on an XM Cloud CM — use "
                + "TOOL_PROFILE=xp with DISABLED_TOOLS if you need those.",
        },
        disabledTools: {
            "common-publish-item":
                "An XM Cloud CM has no web database and no local Edge publishing target; "
                + "publishing is a deployment-environment operation.",
            "common-restart-application":
                "The CM is a managed container; recycling the application pool is not the "
                + "caller's to do.",
        },
    },
};

export type ToolGating = {
    /** Allowlisted groups, or null when `TOOL_GROUPS` is unset (register everything). */
    enabledGroups: Set<string> | null;
    /** Groups hidden by the active profile. */
    disabledGroups: Set<string>;
    /** Tool names hidden by the active profile or by `DISABLED_TOOLS`. */
    disabledTools: Set<string>;
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
    for (const group of requestedGroups) {
        if (!known.has(group)) {
            console.error(
                `TOOL_GROUPS: unknown group '${group}'. Known groups: ${TOOL_GROUPS.join(", ")}.`
            );
        }
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
        enabledGroups: requestedGroups.length > 0 ? new Set(requestedGroups) : null,
        disabledGroups: new Set(Object.keys(profile?.disabledGroups ?? {})),
        disabledTools: new Set([
            ...Object.keys(profile?.disabledTools ?? {}),
            ...splitList(env.DISABLED_TOOLS),
        ]),
    };
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
 * Patches `server.registerTool` so that a denylisted tool is silently not registered.
 *
 * Filtering here rather than at each call site means `DISABLED_TOOLS` covers every tool
 * in the server, including the ones a single registrar function registers several of.
 * The group allowlist is applied in `register.ts`, which skips whole registrar sets and
 * so also skips their startup cost.
 */
export function withToolGating(server: McpServer, gating: ToolGating): McpServer {
    if (gating.disabledTools.size === 0) {
        return server;
    }

    const originalRegisterTool = server.registerTool.bind(server) as (...args: any[]) => any;

    (server as any).registerTool = (name: string, config: Record<string, any>, cb: any) => {
        if (!isToolEnabled(name, gating)) {
            return undefined;
        }
        return originalRegisterTool(name, config, cb);
    };

    return server;
}
