# Tool selection

AI agents have a limit on the number of tools they can use, and schema cost is paid on
every turn whether a tool is called or not. Disabling the tools you don't need makes your
agent faster, cheaper and more efficient.

Three environment variables control which tools get registered. All three are unset by
default, which registers everything, and the denylist always wins on conflict.

## `TOOL_GROUPS`

A comma-separated allowlist of tool groups. The groups are the directory layout, not a new
taxonomy:

`graphql`, `authoring.core`, `authoring.content`, `authoring.management`, `item-service`,
`powershell.core`, `powershell.composition`, `powershell.security`, `powershell.common`,
`powershell.presentation`, `powershell.logging`, `powershell.provider`,
`powershell.indexing`, `powershell.media`

`powershell.core` is `get-powershell-documentation` and `run-powershell-script`. Unset
means every group. Skipping a group also skips its registrars' startup work, not just
their schemas.

`powershell.media` (`media-upload` / `media-download`) needs the SPE `mediaUpload` /
`mediaDownload` services enabled on the CM — see
[Preparing your Sitecore instance](./sitecore-setup.md). The three `authoring.*` groups
need the Authoring and Management API's own credentials; see
[Configuration](./configuration.md#authoring-and-management-api).

### The three authoring groups

They split the Authoring and Management schema the way Sitecore's own documentation does.

- `authoring.core` — `authoring-introspect-schema` and `authoring-graphql`. Two tools, and
  between them they reach the *entire* schema: workflow, archiving, rules, security,
  languages, databases, site creation. Keep this group even when you trim the others, and
  it is the whole group to keep if you only want the escape hatch.
- `authoring.content` — the authoring half: items, templates, media, sites and search.
  What an agent authoring content wants.
- `authoring.management` — the management half: publishing, jobs and index rebuilds. What a
  deployment or operations agent wants.

An agent authoring pages rarely rebuilds indexes, and a release agent rarely edits
templates, so paying for both when you need one is the cost this split exists to avoid.

### Authoring API vs. Item Service vs. PowerShell

Three groups can read and write an item, and they are not equivalent:

- **`authoring.content`** is the surface Sitecore supports for authoring. It needs no SPE
  Remoting and no Item Service — just the endpoint and a token — so it keeps working where
  those are switched off, which on a hardened SitecoreAI environment is the normal case.
  It also expresses things the others cannot, such as building a template with its
  sections and fields in one call.
- **`item-service`** is the REST surface. Simple reads and writes, session-cookie auth.
- **`powershell.*`** is the deepest and least portable: `run-powershell-script` can do
  anything the CM can, and the composition tools validate a layout before writing it.
  Requires SPE Remoting.

If you are trimming for an authoring agent on SitecoreAI, `authoring.core` +
`authoring.content` + `powershell.composition` is a strong, small surface.

#### Read latency

The three surfaces also differ in speed. Measured against a SitecoreAI dev CM (same item,
warm connections, auth excluded, five reads each):

| Surface                        | median | spread     |
| ------------------------------ | ------ | ---------- |
| Item Service (REST)            | 41 ms  | 39–41 ms   |
| Edge GraphQL (the CM's schema) | 85 ms  | 82–106 ms  |
| Authoring GraphQL              | 107 ms | 87–124 ms  |

The Item Service is a thin REST read and roughly halves the latency of either GraphQL
endpoint, with almost no jitter. That ranking holds for single-item reads only: one
GraphQL query fetching many items or fields beats N Item Service round-trips, so the
per-call advantage inverts as soon as a query can batch. Auth also lands differently on
first use — the Item Service logs in once per session with a cookie, while the authoring
tools pay an extra round-trip to mint the bearer token.

So for a quick read of one item, prefer `item-service-get-item`; reach for GraphQL when
one query replaces several calls, or when you need what only that schema can see
(unpublished content on authoring, published-only content on Edge).

### Composition vs. presentation

`powershell.composition` is the site-aware composition set, kept separate from
`powershell.presentation` because the two answer different questions.

- `powershell.presentation` is the thin SPE wrapper set: it writes the layout it is told
  to, including an invalid one. A client that only inspects a page's structure wants this.
- `powershell.composition` reads placeholder settings, datasource locations and available
  renderings in order to _refuse_ an invalid layout. This is the one to reach for when
  authoring pages.

## `DISABLED_TOOLS`

A comma-separated list of exact tool names to leave unregistered:

```
DISABLED_TOOLS=indexing-find-item,run-powershell-script
```

## `TOOL_PROFILE`

A documented preset denylist for a platform. `DISABLED_TOOLS` entries are unioned on top
of it. This server targets SitecoreAI (SAI) **and** XM/XP, so **no tool is disabled by
default**: what is dead weight on one platform is core workflow on the other.

The profile table lives in [`src/tool-profiles.ts`](../src/tool-profiles.ts).

| Profile         | Hides                                 | Why                                                                                                                                                                                                                                                                                                                   |
| --------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `xp` (or unset) | nothing                               | Publishing, application restart and CM-side identity management are all real operations on XM/XP.                                                                                                                                                                                                                     |
| `sai`           | the `powershell.security` and `powershell.logging` groups | Users, roles and domains are managed in the Sitecore Cloud Portal, not on the CM, so the CM-side identity tools are misleading at best. Note that this also hides the item ACL, lock and protect tools, which _do_ work on a SitecoreAI CM — if you need those, use `TOOL_PROFILE=xp` with `DISABLED_TOOLS` instead. `powershell.logging` holds only `logging-get-logs`, which reads log files from the CM's data folder: on SitecoreAI the platform collects logs instead, and on a local Docker CM they are already on a mounted volume. |

`common-publish-item` and `common-restart-application` stay available under `sai`: on
SitecoreAI, content publishes to Edge, which lives on Sitecore's cloud servers only (there
is no `web` database), so publishing works on deployed environments — a local development
CM simply has no publishing target. Hide either with `DISABLED_TOOLS` if you prefer.
