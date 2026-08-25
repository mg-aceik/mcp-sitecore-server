import type { McpServer } from "@modelcontextprotocol/server";

/**
 * Tool gating: which of the server's 138 tools get registered.
 *
 * (134 tools are fixed; the GraphQL group adds two more — a query tool and an
 * introspection tool — per entry in `GRAPHQL_SCHEMAS`. 138 is the total with the default
 * `edge,master`. Verified against a live server's tools/list.)
 *
 * Schema cost is paid on every turn whether a tool is ever called or not, so a client
 * that only needs part of the surface should be able to say so. Three optional
 * environment variables, all unset by default:
 *
 * - `TOOL_GROUPS`   — allowlist of groups to register (the directory layout, see below).
 * - `DISABLED_TOOLS`— denylist of exact tool names.
 * - `TOOL_PROFILE`  — a comma-separated list of documented preset denylists: `xp`/`sai`
 *                     name a platform, and `no-spe`, `no-item-service`, `no-edge-graphql` and
 *                     `no-authoring-api` each name one API surface this instance does not
 *                     serve. What every named profile hides is unioned.
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
 * The three `authoring.*` groups are the Authoring and Management GraphQL API, split the
 * way Sitecore's own documentation splits that schema. `authoring.core` is the raw
 * endpoint — introspection and an any-document tool — and is what keeps the rest of the
 * schema (workflow, archiving, rules, security, language, database) reachable without a
 * typed tool for each. `authoring.content` is the authoring half: items, templates, media,
 * sites, search. `authoring.management` is the management half: publishing, jobs and index
 * rebuilds. They are separate because the content tools are wanted by anything authoring,
 * while the management tools are wanted by a deployment or operations agent, and an agent
 * doing one rarely does the other.
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
    "authoring.core",
    "authoring.content",
    "authoring.management",
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
 * One reason, shared by the nine `powershell.*` entries of `no-spe`, and one shared by
 * the three `authoring.*` entries of `no-authoring-api`. Every group in each set fails
 * for the same reason, and writing nine variations of one sentence would imply nine
 * causes to whoever reads the table looking for theirs.
 */
const SPE_ABSENT =
    "Every tool in this group runs a script over the SPE `remoting` service at "
    + "`POST /-/script/script/`. Without SPE installed and remoting enabled, each one fails "
    + "at the request with a 404 or a 403 rather than doing anything.";

const AUTHORING_ABSENT =
    "The Authoring and Management API at `/sitecore/api/authoring/graphql/v1/` is not served "
    + "by this instance, or no OAuth credentials for it are configured, so every call fails "
    + "before it reaches a resolver.";

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
            "powershell.logging":
                "`logging-get-logs` reads log files off the CM's data folder, which does not work "
                + "on SitecoreAI: a deployed environment's logs are collected by the platform and "
                + "read through the Cloud Portal or your log sink, not from a path on disk. On a "
                + "local Docker CM the files are right there on the mounted volume, so reading "
                + "them over SPE is the long way round. The group holds only that one tool.",
        },
        disabledTools: {},
    },
    /*
     * The `no-*` profiles below are subtractive rather than platform presets: each one
     * names a single API surface that is not there to be called, on the instance this
     * server is pointed at. `xp` and `sai` answer "which platform is this?" and are
     * mutually exclusive; these answer "which of the four surfaces does this instance
     * actually serve?", and an instance can be missing more than one at once — which is
     * why `TOOL_PROFILE` takes a list and unions what each entry hides.
     *
     * They exist because the alternative is saying the same thing as a `TOOL_GROUPS`
     * allowlist, which means enumerating every group you *do* want and revisiting that
     * list every time a group is added. Naming the one surface that is absent stays
     * correct as the server grows.
     *
     * Nothing here probes Sitecore. This is a statement the operator makes about their
     * instance, not something the server infers: a probe that misjudged a transient
     * network failure would silently delete most of the tool surface, and an operator who
     * knows the answer should not have to pay a round trip at startup for it.
     */
    "no-spe": {
        description:
            "An instance with no Sitecore PowerShell Extensions, or with the `remoting` service "
            + "left disabled — the state SPE ships in. Hides every `powershell.*` group, which is "
            + "roughly three quarters of this server's tools, because all of them reach Sitecore "
            + "through that one endpoint.",
        disabledGroups: {
            "powershell.core": SPE_ABSENT,
            "powershell.composition": SPE_ABSENT,
            "powershell.security": SPE_ABSENT,
            "powershell.common": SPE_ABSENT,
            "powershell.presentation": SPE_ABSENT,
            "powershell.logging": SPE_ABSENT,
            "powershell.provider": SPE_ABSENT,
            "powershell.indexing": SPE_ABSENT,
            "powershell.media": SPE_ABSENT,
        },
        disabledTools: {},
    },
    "no-item-service": {
        description:
            "An instance that does not serve the Item Service REST API. Hides the `item-service` "
            + "group only — items stay readable and writable through the `authoring-*` tools and "
            + "through SPE.",
        disabledGroups: {
            "item-service":
                "The Item Service REST API under `/sitecore/api/ssc/item/` is not served, so every "
                + "tool in this group fails at the request. Item reads and writes remain available "
                + "through `authoring-*` (GraphQL) and the SPE `provider-*` and `common-*` tools.",
        },
        disabledTools: {},
    },
    "no-edge-graphql": {
        description:
            "An instance with no Edge or preview GraphQL endpoint, or no API key for one. Hides "
            + "the `graphql` group. This is the delivery-side surface only: it shares nothing with "
            + "the Authoring and Management API, which is a different endpoint with different "
            + "credentials and is hidden by `no-authoring-api` instead.",
        disabledGroups: {
            graphql:
                "The Edge and preview endpoints under `/sitecore/api/graph/` need an `sc_apikey` "
                + "that this instance either does not accept or has not been given. The group is "
                + "sized by `GRAPHQL_SCHEMAS` — a query tool and an introspection tool per schema "
                + "— so what it hides grows with that list.",
        },
        disabledTools: {},
    },
    "no-authoring-api": {
        description:
            "An instance that does not expose the Authoring and Management GraphQL API, or a "
            + "deployment with no credentials for it. Hides all three `authoring.*` groups. Worth "
            + "setting deliberately: with nothing configured those tools stay registered and fail "
            + "per call, because the server cannot tell at startup whether you intended to use "
            + "them.",
        disabledGroups: {
            "authoring.core": AUTHORING_ABSENT,
            "authoring.content": AUTHORING_ABSENT,
            "authoring.management": AUTHORING_ABSENT,
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

    // `TOOL_PROFILE` takes a list, not one name. The `no-*` profiles are subtractive and
    // an instance can be missing more than one surface at once -- a headless CM with
    // neither SPE remoting nor the Item Service is an ordinary shape, not a corner case,
    // and forcing that operator to fall back to spelling out a `TOOL_GROUPS` allowlist
    // would defeat the point of having the profiles. A single name is this same code path
    // with one entry, so every existing value keeps behaving as it did.
    const requestedProfiles = splitList(env.TOOL_PROFILE).map((name) => name.toLowerCase());
    const profiles: ToolProfile[] = [];
    for (const name of requestedProfiles) {
        const profile = TOOL_PROFILES[name];
        if (profile) {
            profiles.push(profile);
        } else {
            console.error(
                `TOOL_PROFILE: unknown profile '${name}'. Known profiles: `
                + `${Object.keys(TOOL_PROFILES).join(", ")}. Ignoring '${name}'.`
            );
        }
    }

    return {
        enabledGroups: recognisedGroups.length > 0 ? new Set(recognisedGroups) : null,
        // Unioned across the profiles: two profiles naming the same group is not a
        // conflict, it is two reasons the group is unusable, and hiding it once is the
        // right answer to both.
        disabledGroups: new Set(profiles.flatMap((profile) => Object.keys(profile.disabledGroups))),
        disabledTools: new Set([
            ...profiles.flatMap((profile) => Object.keys(profile.disabledTools)),
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
