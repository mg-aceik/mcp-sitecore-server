# Changelog

All notable changes to this project will be documented in this file. The format is based
on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Major versions of this project include breaking changes to the tool surface and track the
Model Context Protocol revision the server implements, though not strictly bound to it.

Our versioning strategy is as follows:

- Patch: no breaking changes (e.g. bug fixes, minor improvements)
- Minor: non-breaking feature additions – no breaking changes (e.g. new tools, improvements)
- Major: new features + breaking changes (e.g. SDK upgrades, tool renames, protocol revisions)

## 2.0.0

_Released 2026-08 — a fourth API surface, a tool surface a third smaller per operation, on the v2
MCP SDK and MCP protocol revision 2026-07-28._

### 🎉 New Features & Improvements

- `[sdk]` **The server runs on the v2 MCP TypeScript SDK and speaks MCP protocol revision
  2026-07-28.** This is the headline of the release: `@modelcontextprotocol/sdk` is replaced
  by `@modelcontextprotocol/server` and `@modelcontextprotocol/node`, tool schemas are built
  with zod 4's own JSON Schema conversion, and both transports serve the 2026-07-28 revision
  _and_ the 2025 handshake from the same tool registrations — a client on either revision
  sees the same tools, so nothing has to move revision to keep working. The new revision has
  no initialize handshake and no protocol-level session, so Streamable HTTP is served
  statelessly: no per-session transport map, no session IDs, no sniffing the first request.

#### New tools

- `[authoring]` **Support for the [Sitecore Authoring and Management GraphQL
  API](https://doc.sitecore.com/sai/en/developers/sitecoreai/content-modeling-and-presentation/sitecore-authoring-and-management-graphql-api.html)
  — 22 new tools, the largest single addition in this release.** This is the surface Sitecore
  supports for authoring writes, and the one that matters most on SitecoreAI: it reaches the
  CM over plain HTTP with an OAuth bearer token, so it needs neither SPE Remoting nor the
  Item Service, and it keeps working on environments where both are switched off. It also
  expresses operations the other surfaces cannot — building a data template with its
  sections and fields in a single call, for one.

  The endpoint and its credentials are separate from the existing `GRAPHQL_*` block, which
  talks to Edge and preview with an `sc_apikey`. New settings: `AUTHORING_ENDPOINT` (which
  defaults to `ITEM_SERVICE_SERVER_URL` plus the fixed
  `/sitecore/api/authoring/graphql/v1/` path, so it rarely needs setting),
  `AUTHORING_CLIENT_ID` / `AUTHORING_CLIENT_SECRET` for the client-credentials grant,
  `AUTHORING_TOKEN` for a token you already hold, and `AUTHORING_AUTHORITY` /
  `AUTHORING_AUDIENCE`, which default to the Sitecore Cloud values. Tokens are minted on
  demand, cached until shortly before they expire and renewed without attention, and
  concurrent tool calls share one token request rather than one each.

  The tools, in three new groups:
  - `authoring.core` — `authoring-introspect-schema`, `authoring-graphql`. Two tools that
    between them reach the _entire_ schema, including the parts no typed tool wraps:
    workflow, archiving, rules, security, languages, databases, site creation.
  - `authoring.content` — `authoring-get-item`, `authoring-create-item`,
    `authoring-update-item`, `authoring-delete-item`, `authoring-copy-item`,
    `authoring-move-item`, `authoring-rename-item`, `authoring-search`,
    `authoring-get-item-template`, `authoring-create-item-template`,
    `authoring-update-item-template`, `authoring-upload-media`,
    `authoring-get-media-item`, `authoring-list-sites`, `authoring-get-site`.
  - `authoring.management` — `authoring-publish-item`, `authoring-publishing-status`,
    `authoring-rebuild-indexes`, `authoring-get-job`, `authoring-list-jobs`.

  Every input type, field name and selection set was taken from a live endpoint's own SDL
  rather than from the documentation's examples, and the 28-test live suite in
  `tests/authoring/authoring-live.test.ts` runs each tool against a real CM.

- `[authoring]` **`authoring-upload-media` does both halves of the upload.** Sitecore's
  `uploadMedia` mutation returns a pre-signed URL rather than accepting bytes, so a tool
  that stopped there would hand an agent a URL it has no way to POST to. This one fetches
  the pre-signed URL and uploads the file behind it, taking the bytes from a `sourceUrl`
  this server fetches, a `filePath` local to the server, or inline base64 — the same three
  sources as `media-upload`, and confined by the same `MEDIA_LOCAL_FILE_ROOT` and private-
  address guards.

- `[authoring]` **`authoring-introspect-schema` ships its own introspection query.**
  graphql-js's `getIntrospectionQuery()` nests `ofType` nine levels deep and the endpoint
  enforces a maximum query depth of 13, so the standard query is refused outright with
  _"The query exceded the maximum allowed execution depth of 13"_ and returns no schema at
  all. The shipped query is the same document with the type-reference chain shortened to
  seven levels — still far more wrapping than any real type uses, and verified to return the
  full 117KB SDL from a live endpoint.

- `[authoring]` **An unauthenticated call is reported as one.** The endpoint answers an
  unauthorized request with HTTP 200 and an `AUTH_NOT_AUTHENTICATED` entry in `errors`, so a
  client that checks only the status code reports "no data returned" for what is really a
  credentials problem. The client inspects the GraphQL errors and says which it is; a 404
  names `GraphQL.Enabled`, and a token rejection names the audience.

- `[composition]` **`add-rendering-to-placeholder`** — the tool to compose a page with.
  Adds a rendering to a placeholder and _refuses_ it when the placeholder's settings do not
  allow that component, naming the allow-list in the error; `presentation-add-rendering`
  writes whatever it is told, and an invalid layout still saves and renders. Assigns a
  collision-free `DynamicPlaceholderId` when the rendering's parameters template defines one,
  writes the full parameter set the template declares, and returns the placeholder path a
  child rendering should target — so a nested build is one call per level. `force=true`
  skips validation for migration and repair work.

- `[composition]` **`get-allowed-components-by-placeholder`** — lists the renderings a
  placeholder actually allows on a given page, resolving site-level settings
  (`<site>/Presentation/Placeholder Settings`) first and falling back to the global tree;
  `settingsItemPath` reports which item answered. Handles dynamic placeholders by matching a
  runtime path's leaf segment against wildcard keys such as `container-{*}`. Allowed control
  IDs that resolve to no item are surfaced under `Unresolved` rather than dropped, and
  `Found=false` means no settings item governs the key at all.

- `[composition]` **`create-component-datasource`** — creates a component's datasource item
  from the Datasource Template and Datasource Location declared on the rendering itself.
  `placement='page-local'` (default) creates `<page>/Data/<name>` and returns the
  `local:/Data/<name>` reference form authored pages use; `placement='shared'` walks the
  rendering's pipe-separated location candidates in order and creates the item in the first
  that exists, failing with every candidate it tried rather than guessing. Field values
  passed in `fields` are set on the new item.

- `[presentation]` **`presentation-list-renderings`** — reads a page's presentation as rows
  rather than a layout XML blob: `Index`, `Placeholder`, `RenderingName`, `RenderingID`,
  `Datasource` and `UniqueId`, which are the identifiers the other presentation tools
  address. Defaults to the final layout, the effective presentation for the page.
  `includeParameters` is off by default — on an SXA or Stride site the URL-encoded parameter
  blobs more than doubled the response for a 25-rendering page.

- `[media]` **`media-upload`** — uploads a file into the media library over the SPE
  `mediaUpload` handler. Takes its bytes from a `sourceUrl` fetched by the server (the
  migration path — nothing large ever passes through the model), a server-local `filePath`,
  or base64 `content`, and returns the created media item with its ID, setting `alt` in the
  same round trip.

- `[media]` **`media-download`** — pulls a media item's bytes back out over the SPE
  `mediaDownload` handler, writing to a server-local file via `saveTo` or returning
  size-capped inline base64. Both media tools need their SPE service enabled on the CM; the
  setup doc's patch now ships `mediaUpload` / `mediaDownload` enabled. Verified live against
  a SitecoreAI development CM: download-to-file, oversized-inline refusal, upload from a
  local file, and upload straight from a live site URL.

- `[composition]` **`list-sites`** — lists the content sites registered on the CM with name,
  root path, start path, database, hostname and the root item's ID and template. Sitecore's
  own infrastructure sites (shell, login, service, …) are filtered out unless
  `includeSystemSites` is passed.

- `[composition]` **`get-site-information`** — returns one site's definition plus the paths
  the rest of the composition set needs: home item, site-level Placeholder Settings root,
  Available Renderings root, shared Data folder, site definition item, and the project
  (tenant) folder used to resolve global placeholder settings. Address it by site name, or by
  any item path inside the site.

- `[composition]` **`list-site-components`** — the site's component inventory, grouped by its
  Available Renderings groups (Page Content, Page Structure, FEaaS, Forms, Global on a Stride
  site). Explicitly _not_ an allow-list — the groups say nothing about where a rendering may
  be placed, which is what `get-allowed-components-by-placeholder` answers.

- `[composition]` **`get-pages-by-site`** — lists a site's pages, where "page" means the item
  has presentation (a layout on the item or on its template's standard values) rather than a
  guess from template naming. Returns `Matched`, `Returned` and `Truncated` alongside the
  rows, so a truncated listing is visible as one; `rootPath` scopes the scan to a section.

- `[composition]` **`search-site-pages`** — the same page rows, filtered by a
  case-insensitive substring match against `Name`, display name, `Title` and
  `NavigationTitle`.

- `[composition]` **`list-insert-options`** — the templates and branches that may be created
  under an item, read from `__Masters` (which inherits from the template's standard values).
  Each row reports `Kind`, since a `Branch` copies a whole subtree and a `Template` creates a
  single item. Insert _rules_ are not evaluated — the `uiGetMasters` pipeline is not available
  on a SitecoreAI CM — so a project that uses them may see more options in the Content Editor
  than are listed here.

- `[security]` **`security-export-user`** and **`security-import-user`** — serialize a user
  to disk and read one back, wrapping `Export-User` / `Import-User` with `identity` plus an
  optional `root` or `path`.

- `[security]` **`security-export-role`** and **`security-import-role`** — the same for
  roles, over `Export-Role` / `Import-Role`.

  All four are unblocked by SPE 8.0 and verified against a SitecoreAI development CM running
  it. The export cmdlets were broken before SPE 8.0
  ([SPE #1369](https://github.com/SitecorePowerShell/Console/issues/1369),
  [#1370](https://github.com/SitecorePowerShell/Console/issues/1370)); the import cmdlets NRE
  only when the serialized file does not exist yet
  ([#1371](https://github.com/SitecorePowerShell/Console/issues/1371),
  [#1372](https://github.com/SitecorePowerShell/Console/issues/1372)) — export first.
  `security-login-user` and `security-logout-user` will not be added: SPE 8.0 hollowed
  `Login-User` and `Logout-User` and marked them obsolete for removal
  ([#1367](https://github.com/SitecorePowerShell/Console/issues/1367),
  [#1368](https://github.com/SitecorePowerShell/Console/issues/1368)). The whole security
  group stays hidden under `TOOL_PROFILE=sai`, where identity is a Cloud Portal concern and
  Sitecore CLI is the supported serialization route.

#### Performance and token cost

- **`tools/list` drops from 162 tools / 150,038 characters to 111 tools / 100,091
  characters** — 51 fewer tools and a third less schema on every turn, measured against the
  same SitecoreAI CM before and after. The `-by-id` / `-by-path` merge accounts for the tool
  count and most of the reduction; zod 4's tighter JSON Schema takes the remaining
  106,822 → 100,091. 426 of 472 parameters still carry their description — the same 426 as
  before, the other 46 being parameters that never had one.

  That measurement isolates the merge. Everything else this release adds lands on top of it:
  the composition set, the two media tools, the four security serialization tools and the 22
  Authoring and Management tools, less the three removed (`sitecore-cli-documentation`,
  `item-service-run-stored-query` and `item-service-run-stored-search`). The registered total
  is **138** — 134 fixed, plus two per entry in `GRAPHQL_SCHEMAS`, so 138 with the default
  `edge,master`. `TOOL_GROUPS` and `TOOL_PROFILE` are how a deployment gets back below the
  post-merge figure: `TOOL_PROFILE=sai` alone hides 36 of them.

- **Response projection for the item-returning PowerShell tools.** `fields` names the fields
  to return and `full` opts back into the whole set, so a call that needs three fields no
  longer pays for every field on the item.

- **`common-get-archive-item` pages, and reports the archive's total.** New `first` (default 100) and `skip` parameters, and the response is now an object carrying `Archive`, `Total`,
  `Skip`, `First`, `Returned` and `Items` rather than a bare row list. A recycle bin is a tail
  nobody trims: the CM this was measured against holds 9,769 entries, and an unfiltered call
  returned roughly 3.3M characters even after response projection. The default page is
  ~32,000 characters, and `Total` means an agent can see it is looking at a page instead of
  discovering the archive's size by paying for it.

- **Error shaping** reduces a failed SPE call to the message and the parameter sets, rather
  than returning the whole CliXml exception.

- **Tool gating via `TOOL_GROUPS`, `DISABLED_TOOLS` and `TOOL_PROFILE`** lets a deployment
  register only the groups it uses, which is the largest single lever on `tools/list` cost.
  The `sai` profile hides the whole `powershell.security` group for SitecoreAI, where
  identity lives in the Cloud Portal, and `powershell.logging`, whose only tool
  (`logging-get-logs`) reads log files off the CM's data folder: a deployed SitecoreAI
  environment has the platform collect its logs, so the tool has nothing to read, and a local
  Docker CM already exposes them on a mounted volume, so going through SPE is the long way
  round. `common-publish-item` and `common-restart-application` _are_ available under `sai`,
  since on SitecoreAI content publishes to Edge and a deployed environment does have a
  publishing target (a local development CM does not).

- **Four `TOOL_PROFILE` presets for a missing API surface**, and `TOOL_PROFILE` now takes a
  comma-separated list so they compose. `no-spe`, `no-item-service`, `no-edge-graphql` and
  `no-authoring-api` each hide the groups belonging to one of the server's four surfaces,
  for an instance that does not serve it. `no-spe` is the significant one: SPE ships with
  `remoting` disabled, and without it roughly three quarters of this server's tools cannot
  run — schema an agent otherwise pays for on every turn. Saying which surface is absent
  beats the equivalent `TOOL_GROUPS` allowlist, which has to enumerate every group you _do_
  want and needs revisiting whenever a group is added. Nothing probes Sitecore to infer
  this: a startup probe that misread a transient network failure would silently delete most
  of the tool surface.

#### Existing tools

- `[powershell]` **`get-powershell-documentation` reveals the SPE reference progressively
  instead of returning all of it.** It used to concatenate all 148 command pages — about
  570KB of markdown — into a single tool result, so an agent that wanted the parameters of one
  cmdlet paid for the parameter tables of the other 147. It now answers in widening steps,
  each one telling you how to make the next: no arguments returns every command name with a
  one-line summary grouped by category (~13KB, about 2% of the corpus); `search` matches
  names, summaries and page bodies for when you know the task but not the cmdlet; `category`
  lists one group; and `command` returns the full page for up to five named commands.
  Case-insensitive, and a miss suggests the nearest names rather than just failing — a typo
  like `Get-ItemTemplates` is answered with `Get-ItemTemplate` first. There is deliberately no
  "return everything" mode.

- `[powershell]` **The bundled SPE command reference is re-synced with upstream.** 145 of the
  149 pages were already byte-identical to `SitecorePowerShell/Book`; four had drifted, and
  `Find-Item` was the one that mattered — the bundled page documented neither `-Path`,
  `-Template`, `-Property` nor `-LatestVersion`, all of which a real search script needs.
  `Invoke-JavaScript`, `Show-ModalDialog` and `Send-SheerMessage` were refreshed too.
  `packaging/import-item-1.md`, a byte-identical duplicate of `import-item.md`, and
  `commands-list.md`, whose every link pointed at a path that exists in neither this repo nor
  upstream, are both dropped — the index is generated from the pages now. One page is
  corrected rather than copied: `restore-archiveitem.md` is headed `# Remove-ArchiveItem`
  upstream, though its filename, syntax block and body are all `Restore-ArchiveItem`.

- `[presentation]` **`presentation-switch-rendering` returns the switched instance(s).**
  SPE's `Switch-Rendering` assigns the replacement a NEW uniqueId, so the id the caller
  passed in dies with the old instance — and the tool used to return nothing, leaving every
  follow-up call aimed at an id that no longer existed. The tool now diffs the rendering
  list around the switch and returns one row per switched instance (new `UniqueId`,
  `RenderingID`, `Placeholder`, `Datasource`). The uniqueId form also fails loudly when the
  diff comes back empty, so a switch that changed nothing can never read as success (SPE 8
  throws its own error for an unknown id; the guard covers SPE paths that no-op instead).

### 🛠 Breaking Changes

- `[item-service]` **`item-service-run-stored-query` and `item-service-run-stored-search`
  are removed.** Both ran a saved query or search _definition item_ by GUID — a Sitecore
  feature that assumes someone has already authored the definition in the content tree. No
  caller ever had that GUID to hand, so the tools cost schema on every turn without being
  reachable in practice. `item-service-search-items`, `authoring-search` and
  `indexing-find-item` cover searching from a query you actually have.

- `[sitecore-cli]` **`sitecore-cli-documentation` is removed, along with its `sitecore-cli`
  tool group.** The tool served a bundled snapshot of the Sitecore CLI documentation, which
  had gone out of date and could only ever go further out of date. Sitecore's own
  documentation MCP server answers the same questions against the live docs, so carrying a
  stale copy cost a tool's schema on every turn to give worse answers. `TOOL_GROUPS` no
  longer accepts `sitecore-cli` — an entry naming it is reported on stderr and ignored, as
  any unknown group is.

- **The `-by-id` / `-by-path` tool families are merged into one tool per operation.** 99
  tools were variants of 48 operations, differing only in how the caller named the item.
  Each merged tool drops the suffix and takes optional `id` and `path`, requiring exactly
  one; the old names are gone and are **not** aliased, because keeping them would double the
  surface again and defeat the point. Supplying both, or neither, is an input error naming
  the valid inputs, rejected in TypeScript before any PowerShell runs — two inputs used to be
  resolved only by Sitecore's own cmdlet precedence, which the caller cannot see.

  Merged operations, all following `<name>-by-id` / `<name>-by-path` → `<name>`:
  - `common-` — `add-base-template`, `add-item-version`, `convert-from-item-clone`,
    `get-item-clone`, `get-item-field`, `get-item-reference`, `get-item-referrer`,
    `get-item-template`, `get-item-workflow-event`, `invoke-workflow`, `new-item-clone`,
    `new-item-workflow-event`, `publish-item`, `remove-base-template`,
    `remove-item-version`, `reset-item-field`, `set-item-template`, `test-base-template`,
    `update-item-referrer`
  - `presentation-` — `add-placeholder-setting`, `add-rendering`, `get-layout`,
    `get-placeholder-setting`, `get-rendering`, `get-rendering-parameter`,
    `list-renderings`, `merge-layout`, `remove-placeholder-setting`, `remove-rendering`,
    `remove-rendering-parameter`, `reset-layout`, `set-layout`, `set-rendering`,
    `set-rendering-parameter`, `switch-rendering`
  - `security-` — `add-item-acl`, `clear-item-acl`, `get-item-acl`, `lock-item`,
    `protect-item`, `set-item-acl`, `test-item-acl`, `unlock-item`, `unprotect-item`
  - `indexing-` — `initialize-search-index-item`, `remove-search-index-item`
  - `item-service-get-item` (was `-by-path` only) and `provider-get-item`

  Three families take a wider union: `provider-get-item` accepts `id`, `path`, `query` or
  `uri`; `presentation-switch-rendering` names the rendering to replace with
  `oldRenderingId`, `oldRenderingPath` or `uniqueId`, keeping the `-UniqueId` route through
  SPE (and issue #62's guard on the two branches that select with `Where-Object`); and the
  tools addressing two things at once — `presentation-add-rendering`,
  `presentation-add-placeholder-setting`, `presentation-set-layout` — validate the item and
  the rendering/setting/layout independently, which makes previously unreachable
  combinations work, such as an item by path with a rendering by ID.

- **Parameter changes that came with the merge.** The presentation tools that took `itemId`
  / `itemPath` now take `id` / `path`, like everything else. `database` is sent only when
  addressing by `id`, since a path carries its own prefix
  (`master:/sitecore/content/Home`); where a variant tool used `path` defaulting to
  `master:` purely as the drive for `-Id` (`provider-get-item`, `security-set-item-acl`,
  both `indexing-*-search-index-item`, `presentation-set-layout`), that role moved to
  `database` with the same default. The `.default("master:")` on `path` in
  `presentation-get-layout`, `-reset-layout` and `-set-layout` is gone: a defaulted path is
  indistinguishable from a supplied one, so every id-addressed call would have looked like
  it named two targets. `security-test-item-acl` keeps the `accessRight` enum from its ID
  variant rather than the path variant's loose string, and `security-add-item-acl` keeps the
  `passThrough` switch only its path variant exposed.

- `[transport]` **The SSE endpoint is gone.** `SSEServerTransport` was removed from the MCP
  specification and from the SDK, so `http://<host>:3001/sse` no longer exists and neither
  does the `/messages` endpoint that went with it. **Any client configured against `/sse`
  must be repointed at Streamable HTTP on `/mcp`** — same host, same port 3001, one endpoint
  instead of two. This affects XM/XP and SitecoreAI deployments alike.

  _Migration:_ change the client's server URL from `http://<host>:3001/sse` to
  `http://<host>:3001/mcp`, and its transport type from "SSE" to "Streamable HTTP".
  `TRANSPORT=sse` still starts a server rather than failing: it serves Streamable HTTP on
  port 3001 and says so on stderr, so a container keeps listening while you repoint its
  clients. The `start:sse` npm script and `src/app.ts` are removed; `npm start` now means
  Streamable HTTP.

- `[deps]` **The SDK packages changed.** `@modelcontextprotocol/sdk` is replaced by
  `@modelcontextprotocol/server`, `@modelcontextprotocol/node` and (for tests)
  `@modelcontextprotocol/client` — see the v2 SDK entry under New Features for what that
  buys.

  _Migration:_ none required for clients. Anyone embedding this package's modules directly
  should note that `McpServer` and `CallToolResult` now come from
  `@modelcontextprotocol/server`.

- `[deps]` **The supported runtime is the latest Node.js LTS release**, with `engines.node`
  set to `>=22` as the hard floor. The v2 SDK does not support older runtimes, and Node 20
  reached end of life in April 2026.

  _Migration:_ upgrade Node. The published Docker images already run Node 24.

- `[deps]` **zod 4.2 or later is required**, and `zod` is now a direct dependency rather
  than something inherited from the SDK. v2 builds tool schemas with zod's own JSON Schema
  conversion; on zod 3 the first `tools/list` fails silently, and on zod 4.0–4.1 every
  parameter description is dropped from the schema.

  _Migration:_ none for users of the published package. A checkout needs a fresh
  `npm install`.

- **The Smithery integration is removed.** `smithery.yaml` and the Smithery-generated root
  `Dockerfile` are deleted, along with the README badge. Neither was built by CI — the
  published images come from `docker/linux/Dockerfile` and `docker/windows/Dockerfile` — and
  the config had drifted, exposing none of the tool-gating settings. Install with
  `npx @antonytm/mcp-sitecore-server@latest` or one of the Docker images instead.

### 🔒 Security

- `[media]` **`filePath` and `saveTo` are refused over the HTTP transport by default.**
  Both read and write the filesystem of the machine running this server, which is
  unremarkable on stdio and is arbitrary file read/write for anyone who can reach the port
  under `TRANSPORT=streamable-http`, where `AUTHORIZATION_HEADER` is empty by default. Set
  `MEDIA_LOCAL_FILE_ROOT` to a directory to allow them, confined to it; the confinement
  applies on both transports once set. See
  [Media and the local filesystem](./docs/configuration.md#media-and-the-local-filesystem).

- `[media]` **`sourceUrl` cannot reach private networks.** The server fetches this URL from
  wherever it is deployed, so an unrestricted value would be a server-side request forgery
  primitive against the cloud metadata endpoint and anything else on the CM's network. Only
  `http`/`https` is accepted, hostnames that resolve into private, loopback or link-local
  space are refused unless `MEDIA_ALLOW_PRIVATE_SOURCE_URL=true`, and the fetch is subject to
  the same timeout as every other outbound request.

- `[server]` **The `config` tool and `config://main` resource redact secrets.** Both
  returned the full configuration — the Item Service and PowerShell passwords, the GraphQL
  API key and the server's own `AUTHORIZATION_HEADER` — to any client that could call a
  tool. `AUTHORING_TOKEN` and `AUTHORING_CLIENT_SECRET` are masked on the same footing;
  `AUTHORING_CLIENT_ID` stays visible, since it identifies which automation client is in use
  and is not a credential on its own. The keys remain present so "is one configured?" is
  still answerable.

- `[http]` **The authorization check is constant-time and the `Bearer` strip is anchored.**
  `===` on a shared secret leaks, through timing, how many leading characters were right,
  and the unanchored `Bearer` pattern also matched inside a token that happened to contain
  it. Unauthorized responses are now JSON rather than plain text.

### 🐛 Bug Fixes

- `[indexing]` **`indexing-find-item` reported a failed search as an empty one.** It bypassed
  the shared error shaping entirely, returning the full serialized .NET `ErrorRecord` with
  `isError` unset. It now shapes errors like every other PowerShell tool. Its `first`/`skip`
  are integers, and `criteria` requires at least one entry rather than sending `-Criteria @()`.

- `[logging]` **`logging-get-logs` discarded the shaped error message.** It parsed the tool
  result as JSON without checking `isError`, so a PowerShell failure surfaced as
  "Unexpected token" instead of the message the error shaping had just built. An
  unparseable `date` now errors instead of globbing for `NaNNaNNaN`, and the date is
  formatted in UTC rather than the MCP host's local timezone.

- `[powershell]` **A non-JSON response from the CM was reported as a parse bug.** An HTML
  error page from the CM produced "Unexpected token <" from the very function that owns
  error presentation; it now says what actually happened and shows the start of the response.

- `[http]` **The `/mcp` body limit was Express's 100kb default**, which is smaller than a
  single base64 image, so `media-upload`'s inline `content` failed — as an HTML error, which
  is what the JSON 404 fallback exists to prevent. The limit is now 32mb (`MCP_BODY_LIMIT`)
  and a malformed or oversized body answers in JSON.

- `[config]` **A malformed `GRAPHQL_HEADERS` killed the process during module import**, which
  on stdio is a subprocess that dies with no explanation. It is now reported and ignored, the
  same way an unknown `TOOL_PROFILE` is.

- `[config]` **An unrecognised `TRANSPORT` fell through to stdio in silence**, so a typo in a
  container's config left nothing listening and no clue why. It now says so on stderr.

- `[annotations]` **`query-graphql-<schema>` claimed `readOnlyHint` while forwarding any
  document, mutations included.** The name-based inference in `tool-annotations.ts` reads the
  leading verb, and "query" reads as a read — but the tool only syntax-checks what it is
  given, so a mutation goes through as readily as a query. It now declares its own
  annotations rather than accepting the inferred ones.

- `[http]` **The listen port was hardcoded.** `PORT` and `HOST` are now read, the server logs
  where it is listening, and `EADDRINUSE` explains itself instead of surfacing as an
  unhandled error.

- `[build]` **`prepare` did not produce `dist/bundle.js`**, which `main` and `bin` point at,
  so a git install shipped a `bin` target that did not exist. The Docker image tags now come
  from `$npm_package_version` instead of three hardcoded copies of it.

- `[graphql]` **`query-graphql-<schema>` sent `variables` as a string.** The MCP parameter
  is a JSON string, but it was forwarded verbatim, so the request body carried
  `"variables": "{...}"` instead of a JSON object and GraphQL endpoints rejected any
  parameterized query. The string is now parsed before sending, with a clear error naming
  the expected format when it is not valid JSON. Both GraphQL tools also carry real
  descriptions now — the introspection tool warns about its output size, and the query
  tool spells out what each schema can see (`edge` serves published content only) and
  documents the `query` / `variables` parameters.

- `[presentation]` **`presentation-set-rendering` could never find a rendering that lives
  only in the final layout**, whatever the caller passed for `finalLayout`: its
  `Get-Rendering` lookup sent neither `-FinalLayout` nor `-Language`, so it always searched
  the shared layout in the context language and reported "No matching rendering was found"
  for uniqueIds that `presentation-list-renderings` had just returned. The lookup now targets
  the same layout and language as the update.

- `[presentation]` **The rendering-instance tools now default `finalLayout` to `true`**,
  matching `presentation-list-renderings`: `presentation-get-rendering`, `-set-rendering`,
  `-switch-rendering`, `-remove-rendering`, `-get-rendering-parameter`,
  `-set-rendering-parameter` and `-remove-rendering-parameter`. The final layout is the
  effective presentation and is where the uniqueIds a caller reads from `list-renderings`
  live; with the old shared-layout default, an id straight out of a listing failed for any
  instance that exists only in the final layout. Pass `finalLayout: false` to target the
  shared layout, as before.

- `[common]` `common-publish-item`'s `fromDate` parameter was declared as `z.date()`. zod 4
  refuses to represent a `Date` in JSON Schema, and because the whole tool list is built in
  one pass that single parameter made **`tools/list` fail outright** — the server advertised
  no tools at all. It is now a string carrying the accepted ISO 8601 format in its
  description. Nothing is lost: JSON-RPC parameters are JSON, so a `Date` object could never
  have reached the tool anyway.

- `[deps]` `express` was declared as a devDependency, but rollup keeps it external, so the
  published `dist/bundle.js` opens with `import express from 'express'` and could not start
  without it — on **stdio too**, because the import is eager. It is now a runtime dependency.
  This affected every published version that bundled this way, not just this one.

- `[powershell]` **`get-powershell-documentation` was broken in the published package.** It
  resolved the command reference relative to its own module, which is correct for the loose
  build but not for `dist/bundle.js` — the file `bin` points at, and the one `npx` runs. Every
  user of the npm package or the Docker images got
  `ENOENT ... dist\documentation` while it worked in local development against
  `dist/index.js`. The lookup now tries the layouts both builds produce. Two related causes
  are fixed with it: rollup's copy step was flattening the category folders, and `npm run
build` did not copy the markdown at all, so the loose build only worked if some earlier
  `npm run bundle` had left files behind.

- `[powershell]` **A failed SPE call now says what actually answered.** `executeScript`
  threw `response.statusText` and discarded the body, so a CM whose login is federated to
  Sitecore Cloud — which redirects an unauthenticated remoting call to its identity
  provider, and gets back a 3KB HTML error page and a `400` — reported the two words "Bad
  Request". That is enough to send someone after a disabled `remoting` service when the
  real problem is that HTTP Basic credentials cannot satisfy a cloud CM. The error now
  carries the status, an excerpt of the body with HTML reduced to its visible text, and,
  when the response came from the identity provider rather than Sitecore, says so outright.
  A `429` is named as rate limiting and a `404` still points at the remoting service.

- `[item-service]` **`Login failed` now carries the status and the reason.** A `403` from
  the Item Service means one of two very different things — the account is not valid on this
  instance, or `Sitecore.Services.SecurityPolicy` is still `ServicesOffPolicy` — and the old
  message distinguished neither. It now reports the status, names the account it tried, and
  explains the test that separates the two causes. The other nine call sites in that client
  threw a bare `HTTP error! status: <n>`; all of them now include the status text and a body
  excerpt, which is where the Item Service puts the reason.

### 📝 Documentation

- [Configuration](docs/configuration.md) gains an [Authoring and Management
  API](docs/configuration.md#authoring-and-management-api) section covering both auth routes
  and when to prefer each.
- [Preparing your Sitecore instance](docs/sitecore-setup.md) gains step 5 — switching
  GraphQL on, getting credentials on SitecoreAI and on XM/XP, and the media-upload
  encryption key — plus seven new troubleshooting rows. It also no longer claims that a
  `403` from the Item Service proves `ServicesOffPolicy`: it can equally be a refused
  account, and the page now gives the one-request test that tells the two apart.
- [Tool selection](docs/tool-selection.md) explains what separates the three authoring
  groups, and when to reach for the Authoring API over the Item Service or PowerShell.
- [Tool reference](docs/tools.md) documents three endpoint path rules that are easy to trip
  over: template paths are relative to `/sitecore/templates` with no leading slash, a
  media `itemPath` carries no file extension, and template sections and fields are matched
  by ID rather than by name.
- [Contributing](CONTRIBUTING.md) states what the integration suite actually requires — it
  addresses seeded fixture content by hard-coded GUID, so it fails in bulk against any other
  instance — and maps each failure signature to its cause, so a wall of red is diagnosable
  at a glance.

### ✨ Chores

- `[transport]` Removed the per-session transport map in the Streamable HTTP server, along
  with the initialize-request sniffing, the session-ID generator and the separate GET/DELETE
  session handlers. The 2026-07-28 revision has no initialize handshake and no
  protocol-level session, so there is nothing to key a map on; requests are served
  statelessly and 2025-era GET/DELETE session operations answer `405`. The `/health`
  endpoint, the RFC 9728 OAuth protected-resource metadata route, the JSON 404 fallback and
  the `AUTHORIZATION_HEADER` check are unchanged.

- `[tests]` Removed the MCP inspector's CLI internals from the test suite. `tests/client.ts`
  builds its transport with `StdioClientTransport` from `@modelcontextprotocol/client`, and
  `callTool` is a local helper instead of an undeclared import from
  `@modelcontextprotocol/inspector/cli/build/client/tools.js`.

## 1.4.2

_Released 2026-07-30._

### 🎉 New Features & Improvements

- `[powershell]` **Default PowerShell script timeout raised from 60 seconds to 10 minutes.**
  The 60s default was tuned to the tool-call timeout most AI agents enforce, but in practice
  it fired constantly on larger scripts (index rebuilds, publishing, bulk item updates) and
  aborted work that would have succeeded. The timeout exists to stop a hung Sitecore
  endpoint holding a connection open forever, not to bound legitimate script runtime, so a
  generous default is the safer failure mode — and the calling agent's own tool-call timeout
  still cuts things short first when it is set lower. Override with `POWERSHELL_TIMEOUT_MS`.

## 1.4.1

_Released 2026-07-22._

### 🐛 Bug Fixes

- `[docker]` Docker Hub publish workflows only: the Windows image build now waits for the
  Docker daemon to accept API calls before building, and the published image tags were
  brought up to the current version. No changes to the server itself.

## 1.4.0

_Released 2026-07-22._

### 🔒 Security

- `[powershell]` **PowerShell command injection fixed.** All user-supplied values are now
  escaped as single-quoted PowerShell literals via a new `quotePowerShellString` helper in
  `command-builder.ts` (and `prepareArgsString` in `utils.ts`). Previously values were
  interpolated with basic double-quote wrapping — or, in composite tools, not quoted at all
  — allowing `"`, `$`, backticks and `;` to break out and execute arbitrary commands. All
  composite tools that interpolated parameters directly (indexing, security ACL, archive,
  item clone, item referrer, layout, and rendering tools) now route those values through the
  escaper.

- `[indexing]` `[logging]` `find-item` now escapes the free-text search `value` and `index`;
  `get-logs` restricts the `name` parameter to a safe filename charset (it is interpolated
  into a path glob that cannot be single-quoted).

- `[graphql]` **GraphQL API key moved out of the URL.** The `sc_apikey` is now sent as an
  HTTP header instead of a query-string parameter in `query` and `introspection`, so it is
  no longer captured in access logs, proxies, or browser history.

- **Corrected the TLS-verification environment variable.** `.env.template` now uses the
  Node-recognized `NODE_TLS_REJECT_UNAUTHORIZED`; the previous `NODE_REJECT_UNAUTHORIZED`
  was not recognized by Node and silently had no effect. It still ships set to `0`, since
  the server primarily targets local development against Sitecore/SitecoreAI instances with
  self-signed certificates, but now carries a prominent warning to set it to `1` (or remove
  it) in production or on untrusted networks.

- `[deps]` Updated dependencies to resolve all known advisories — `npm audit` now reports
  **0 vulnerabilities** (previously 18, including 4 critical). Notably bumps
  `@modelcontextprotocol/sdk` to ^1.29.0 and patches transitive `fast-xml-parser`,
  `minimatch`, `brace-expansion`, `body-parser`, and others.

### 🎉 New Features & Improvements

- **Tool annotations for every tool.** A `server.tool` wrapper (`tool-annotations.ts`) now
  infers `readOnlyHint`, `destructiveHint`, and a human-readable `title` from each tool's
  name, so MCP clients can distinguish safe reads from mutations and destructive operations.
  `run-powershell-script` is flagged destructive and open-world.

- **Request timeouts** on all outbound HTTP calls via a shared `fetchWithTimeout` helper
  (Item Service, GraphQL, and PowerShell clients). Defaults: 30s for REST/GraphQL, 60s for
  PowerShell; both configurable via `REQUEST_TIMEOUT_MS` / `POWERSHELL_TIMEOUT_MS`. (60s
  aligns with the tool-call timeout most AI agents enforce, so a longer default would only
  cause the agent to abort before this timeout fires.) The PowerShell default was later
  raised to 10 minutes in 1.4.2.

- `[item-service]` **Traversal guard** in `get-item-descendants`: a visited-set for cycle
  protection and a configurable node cap (`DESCENDANTS_MAX_ITEMS`, default 5000) that
  reports truncation instead of exhausting memory on large or circular item trees.

- `[tests]` **Unit test suite** (`tests/unit/`) covering the PowerShell escaper and
  tool-annotation inference, runnable without a live Sitecore instance via
  `npm run test:unit`.

- **CI workflow** (`.github/workflows/ci.yml`) that type-checks, builds, bundles, runs the
  unit tests, and audits dependencies on every pull request and push to `main`, plus an
  `npm run typecheck` script (`tsc --noEmit`).

- `[transport]` A `/health` liveness endpoint on the HTTP transports (`streamable-http` and
  `sse`) that returns `200 {"status":"ok"}`, plus Docker `HEALTHCHECK` directives for the
  Linux and Windows images that probe it. (The health check reports that the HTTP server is
  accepting requests — the appropriate signal for a container — rather than probing the
  OAuth discovery endpoint.)

- `[deps]` **Migrated to TypeScript 7.** The SDK's generic `tool()` overloads made the `tsc`
  5.x type-checker exhaust its heap across the ~140 registration call sites (the build did
  not complete even with an 8 GB heap). The TypeScript 7 native compiler type-checks the
  same code in under a second, so tool-registration functions use the SDK's `McpServer` type
  directly with no custom indirection. `tsconfig.json` was migrated for TS7:
  `moduleResolution` is now `"bundler"` and the removed `baseUrl` option was dropped (path
  aliases retained as `"@/*": ["./src/*"]`).

- **Migrated all tool registrations from the deprecated `server.tool()` to
  `server.registerTool()`.** The SDK deprecated `tool()` in favour of `registerTool()`;
  every registration now passes a config object (`{ description, inputSchema }`) and the
  `withInferredAnnotations` wrapper injects annotations into that config rather than as a
  positional argument. (Feasible now that the TypeScript 7 switch removed the
  overload-resolution heap blow-up that affected `tool()` and `registerTool()` alike.)

- `[docker]` Docker images pinned to **Node 24** (Linux previously floated on
  `node:lts-alpine`; Windows previously pinned Node 22), matching the CI Node version.
  `@types/node` bumped to ^24 to match the Node 24 runtime. Images that expose an HTTP port
  now default to the `streamable-http` transport.

- Tightened input validation on search/pagination parameters (bounded `page`/`pageSize`,
  non-empty search terms).

### 🛠 Breaking Changes

- `AUTORIZATION_HEADER` renamed to the correctly-spelled `AUTHORIZATION_HEADER` across
  config and `smithery.yaml`. The old misspelled name is no longer recognized.

### 🐛 Bug Fixes

- `[presentation]` **Clearer errors when a rendering lookup finds nothing** (issue #62). The
  presentation tools that resolve a rendering via `Get-Rendering` before acting on it
  previously failed with the opaque PowerShell error "Cannot bind argument to parameter
  'Instance' because it is null." — or, for the switch tools, silently did nothing — when
  the item/rendering/language/layout didn't match. A shared guard (`rendering-guard.ts`) now
  reports an actionable error (via `Write-Error`, which the SPE transport returns as a
  normal response rather than an opaque HTTP 500) naming what was searched for and pointing
  at `presentation-get-rendering-by-id` / `-by-path` to list the item's renderings. Applied
  to all ten affected tools: `set-rendering-by-id`/`-by-path`,
  `set-/get-/remove-rendering-parameter-by-id`/`-by-path`, and
  `switch-rendering-by-id`/`-by-path`.

- Corrected the server description typo "Modle Context Protocol" → "Model Context Protocol".

- `[deps]` Pinned `@antonytm/clixml-parser` to `^0.1.5` instead of the floating `latest` tag.

### ✨ Chores

- Normalized all `McpServer` imports to the `.js` module specifier for consistency.
