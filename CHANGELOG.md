# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-08-22

### Changed

- **BREAKING: the SSE endpoint is gone.** `SSEServerTransport` was removed from the MCP
  specification and from the SDK, so `http://<host>:3001/sse` no longer exists and
  neither does the `/messages` endpoint that went with it. **Any client configured
  against `/sse` must be repointed at Streamable HTTP on `/mcp`** — same host, same port
  3001, one endpoint instead of two. This affects XM/XP and XM Cloud deployments alike.

  *Migration:* change the client's server URL from `http://<host>:3001/sse` to
  `http://<host>:3001/mcp`, and its transport type from "SSE" to "Streamable HTTP".
  `TRANSPORT=sse` still starts a server rather than failing: it serves Streamable HTTP
  on port 3001 and says so on stderr, so a container keeps listening while you repoint
  its clients. The `start:sse` npm script and `src/app.ts` are removed; `npm start` now
  means Streamable HTTP.

- **BREAKING: migrated to the v2 TypeScript SDK**, which implements MCP protocol
  revision **2026-07-28**. `@modelcontextprotocol/sdk` is replaced by
  `@modelcontextprotocol/server`, `@modelcontextprotocol/node` and (for tests)
  `@modelcontextprotocol/client`. Both transports serve the new revision *and* the 2025
  handshake from the same tool registrations, so a client on either revision sees the
  same 111 tools; nothing has to move revision to keep working.

  *Migration:* none required for clients. Anyone embedding this package's modules
  directly should note that `McpServer` and `CallToolResult` now come from
  `@modelcontextprotocol/server`.

- **BREAKING: Node.js 20 or later is required**, declared as `engines.node`. The v2 SDK
  does not support older runtimes.

  *Migration:* upgrade Node. The published Docker images already run Node 24.

- **BREAKING: zod 4.2 or later is required**, and `zod` is now a direct dependency
  rather than something inherited from the SDK. v2 builds tool schemas with zod's own
  JSON Schema conversion; on zod 3 the first `tools/list` fails silently, and on
  zod 4.0–4.1 every parameter description is dropped from the schema.

  *Migration:* none for users of the published package. A checkout needs a fresh
  `npm install`.

  Verified against a live XM Cloud CM after the upgrade: 111 tools, and 426 of 472
  parameters still carry their description — the same 426 as before, the other 46 being
  parameters that never had one. `tools/list` is 100,091 characters, down from 106,822
  on zod 3, because zod 4 emits tighter JSON Schema.

### Fixed

- `common-publish-item`'s `fromDate` parameter was declared as `z.date()`. zod 4 refuses
  to represent a `Date` in JSON Schema, and because the whole tool list is built in one
  pass that single parameter made **`tools/list` fail outright** — the server advertised
  no tools at all. It is now a string carrying the accepted ISO 8601 format in its
  description. Nothing is lost: JSON-RPC parameters are JSON, so a `Date` object could
  never have reached the tool anyway.

- `express` was declared as a devDependency, but rollup keeps it external, so the
  published `dist/bundle.js` opens with `import express from 'express'` and could not
  start without it — on **stdio too**, because the import is eager. It is now a runtime
  dependency. This affected every published version that bundled this way, not just
  this one.

### Removed

- The per-session transport map in the Streamable HTTP server, along with the
  initialize-request sniffing, the session-ID generator and the separate GET/DELETE
  session handlers. The 2026-07-28 revision has no initialize handshake and no
  protocol-level session, so there is nothing to key a map on; requests are served
  statelessly and 2025-era GET/DELETE session operations answer `405`. The `/health`
  endpoint, the RFC 9728 OAuth protected-resource metadata route, the JSON 404 fallback
  and the `AUTHORIZATION_HEADER` check are unchanged.

- The MCP inspector's CLI internals from the test suite. `tests/client.ts` builds its
  transport with `StdioClientTransport` from `@modelcontextprotocol/client`, and
  `callTool` is a local helper instead of an undeclared import from
  `@modelcontextprotocol/inspector/cli/build/client/tools.js`.

## [1.5.0] - 2026-08-22

### Changed

- **BREAKING: the `-by-id` / `-by-path` tool families are merged into one tool per
  operation.** 99 tools were variants of 48 operations, differing only in how the caller
  named the item. Each merged tool now takes optional `id` and `path` and requires exactly
  one; the variant names are gone and are **not** aliased, because keeping them would
  double the surface again and defeat the point. The table below is the migration guide.

  Supplying both, or neither, is an input error that names the valid inputs and is rejected
  in TypeScript before any PowerShell runs. Two inputs used to be resolvable only by
  Sitecore's own cmdlet precedence, which the caller cannot see — a call that names two
  different items should not quietly act on one of them.

  Three families take a wider union: `provider-get-item` accepts `id`, `path`, `query` or
  `uri`; `presentation-switch-rendering` names the rendering to replace with
  `oldRenderingId`, `oldRenderingPath` or `uniqueId`, keeping the `-UniqueId` route through
  SPE (and issue #62's guard on the two branches that select with `Where-Object`); and the
  tools that address two things at once — `presentation-add-rendering`,
  `presentation-add-placeholder-setting`, `presentation-set-layout` — validate the item and
  the rendering/setting/layout independently. That last change makes previously
  unreachable combinations work, such as an item by path with a rendering by ID.

  `tools/list` drops from **162 tools / 150,038 characters** to **111 tools / 106,822
  characters** — 51 fewer tools and 29% less schema on every turn, measured against the
  same XM Cloud CM before and after.

  | Tool | Replaces |
  | --- | --- |
| `item-service-get-item` | `item-service-get-item-by-path` |
| `provider-get-item` | `provider-get-item-by-path`, `provider-get-item-by-id`, `provider-get-item-by-query`, `provider-get-item-by-uri` |
| `common-add-base-template` | `common-add-base-template-by-id`, `common-add-base-template-by-path` |
| `common-add-item-version` | `common-add-item-version-by-id`, `common-add-item-version-by-path` |
| `common-convert-from-item-clone` | `common-convert-from-item-clone-by-id`, `common-convert-from-item-clone-by-path` |
| `common-get-item-clone` | `common-get-item-clone-by-id`, `common-get-item-clone-by-path` |
| `common-get-item-field` | `common-get-item-field-by-id`, `common-get-item-field-by-path` |
| `common-get-item-reference` | `common-get-item-reference-by-id`, `common-get-item-reference-by-path` |
| `common-get-item-referrer` | `common-get-item-referrer-by-id`, `common-get-item-referrer-by-path` |
| `common-get-item-template` | `common-get-item-template-by-id`, `common-get-item-template-by-path` |
| `common-get-item-workflow-event` | `common-get-item-workflow-event-by-id`, `common-get-item-workflow-event-by-path` |
| `common-invoke-workflow` | `common-invoke-workflow-by-id`, `common-invoke-workflow-by-path` |
| `common-new-item-clone` | `common-new-item-clone-by-id`, `common-new-item-clone-by-path` |
| `common-new-item-workflow-event` | `common-new-item-workflow-event-by-id`, `common-new-item-workflow-event-by-path` |
| `common-publish-item` | `common-publish-item-by-id`, `common-publish-item-by-path` |
| `common-remove-base-template` | `common-remove-base-template-by-id`, `common-remove-base-template-by-path` |
| `common-remove-item-version` | `common-remove-item-version-by-id`, `common-remove-item-version-by-path` |
| `common-reset-item-field` | `common-reset-item-field-by-id`, `common-reset-item-field-by-path` |
| `common-set-item-template` | `common-set-item-template-by-id`, `common-set-item-template-by-path` |
| `common-test-base-template` | `common-test-base-template-by-id`, `common-test-base-template-by-path` |
| `common-update-item-referrer` | `common-update-item-referrer-by-id`, `common-update-item-referrer-by-path` |
| `presentation-add-placeholder-setting` | `presentation-add-placeholder-setting-by-id`, `presentation-add-placeholder-setting-by-path` |
| `presentation-add-rendering` | `presentation-add-rendering-by-path`, `presentation-add-rendering-by-id` |
| `presentation-get-layout` | `presentation-get-layout-by-id`, `presentation-get-layout-by-path` |
| `presentation-get-placeholder-setting` | `presentation-get-placeholder-setting-by-id`, `presentation-get-placeholder-setting-by-path` |
| `presentation-get-rendering` | `presentation-get-rendering-by-id`, `presentation-get-rendering-by-path` |
| `presentation-get-rendering-parameter` | `presentation-get-rendering-parameter-by-id`, `presentation-get-rendering-parameter-by-path` |
| `presentation-list-renderings` | `presentation-list-renderings-by-path`, `presentation-list-renderings-by-id` |
| `presentation-merge-layout` | `presentation-merge-layout-by-id`, `presentation-merge-layout-by-path` |
| `presentation-remove-placeholder-setting` | `presentation-remove-placeholder-setting-by-id`, `presentation-remove-placeholder-setting-by-path` |
| `presentation-remove-rendering` | `presentation-remove-rendering-by-path`, `presentation-remove-rendering-by-id` |
| `presentation-remove-rendering-parameter` | `presentation-remove-rendering-parameter-by-id`, `presentation-remove-rendering-parameter-by-path` |
| `presentation-reset-layout` | `presentation-reset-layout-by-id`, `presentation-reset-layout-by-path` |
| `presentation-set-layout` | `presentation-set-layout-by-id`, `presentation-set-layout-by-path` |
| `presentation-set-rendering` | `presentation-set-rendering-by-path`, `presentation-set-rendering-by-id` |
| `presentation-set-rendering-parameter` | `presentation-set-rendering-parameter-by-id`, `presentation-set-rendering-parameter-by-path` |
| `presentation-switch-rendering` | `presentation-switch-rendering-by-id`, `presentation-switch-rendering-by-path`, `presentation-switch-rendering-by-unique-id` |
| `security-add-item-acl` | `security-add-item-acl-by-id`, `security-add-item-acl-by-path` |
| `security-clear-item-acl` | `security-clear-item-acl-by-id`, `security-clear-item-acl-by-path` |
| `security-get-item-acl` | `security-get-item-acl-by-id`, `security-get-item-acl-by-path` |
| `security-lock-item` | `security-lock-item-by-id`, `security-lock-item-by-path` |
| `security-protect-item` | `security-protect-item-by-path`, `security-protect-item-by-id` |
| `security-set-item-acl` | `security-set-item-acl-by-id`, `security-set-item-acl-by-path` |
| `security-test-item-acl` | `security-test-item-acl-by-id`, `security-test-item-acl-by-path` |
| `security-unlock-item` | `security-unlock-item-by-id`, `security-unlock-item-by-path` |
| `security-unprotect-item` | `security-unprotect-item-by-id`, `security-unprotect-item-by-path` |
| `indexing-initialize-search-index-item` | `indexing-initialize-search-index-item-by-id`, `indexing-initialize-search-index-item-by-path` |
| `indexing-remove-search-index-item` | `indexing-remove-search-index-item-by-id`, `indexing-remove-search-index-item-by-path` |

- **Parameter changes that came with the merge.** The presentation tools that took
  `itemId` or `itemPath` now take `id` or `path`, like everything else. `database` is sent
  only when addressing by `id` — a path carries its own prefix, as in
  `master:/sitecore/content/Home` — and where a variant tool used a `path` defaulting to
  `master:` purely as the drive for `-Id` (`provider-get-item`, `security-set-item-acl`,
  the two `indexing-*-search-index-item` tools, `presentation-set-layout`), that role moved
  to `database`, same default. The `.default("master:")` on the `path` input of
  `presentation-get-layout`, `presentation-reset-layout` and `presentation-set-layout` is
  gone: a defaulted path is indistinguishable from a supplied one, so it would have made
  every id-addressed call look like it named two targets. `security-test-item-acl` keeps
  the `accessRight` enum from its ID variant rather than the path variant's loose string,
  and `security-add-item-acl` keeps the `passThrough` switch that only its path variant
  exposed.

### Added

- **`common-get-archive-item` pages, and reports the archive's total.** New `first`
  (default 100) and `skip` parameters, and the response is now an object carrying
  `Archive`, `Total`, `Skip`, `First`, `Returned` and `Items` rather than a bare row list.
  A recycle bin is a tail nobody trims: the CM this was measured against holds 9,769
  entries, and an unfiltered call returned roughly 3.3M characters even after 1.5.0's
  projection. The default page is ~32,000 characters, and `Total` means an agent can see
  it is looking at a page instead of discovering the archive's size by paying for it.

### Also in this release

The tiers that preceded this one, on the same branch lineage: response projection for the
item-returning PowerShell tools (`fields` / `full`), error shaping down to the message and
parameter sets, tool gating via `TOOL_GROUPS` / `DISABLED_TOOLS` / `TOOL_PROFILE`, and the
site-aware composition tools (`get-allowed-components-by-placeholder`,
`create-component-datasource`, `add-rendering-to-placeholder`, `list-sites`,
`get-pages-by-site`, `list-site-components`, `list-insert-options`,
`presentation-list-renderings`).

## [1.4.2] - 2026-07-30

### Changed

- **Default PowerShell script timeout raised from 60 seconds to 10 minutes.** The 60s
  default was tuned to the tool-call timeout most AI agents enforce, but in practice it
  fired constantly on larger scripts (index rebuilds, publishing, bulk item updates) and
  aborted work that would have succeeded. The timeout exists to stop a hung Sitecore
  endpoint holding a connection open forever, not to bound legitimate script runtime, so a
  generous default is the safer failure mode — and the calling agent's own tool-call
  timeout still cuts things short first when it is set lower. Override with
  `POWERSHELL_TIMEOUT_MS`.

## [1.4.1] - 2026-07-22

### Fixed

- Docker Hub publish workflows only: the Windows image build now waits for the Docker
  daemon to accept API calls before building, and the published image tags were brought up
  to the current version. No changes to the server itself.

## [1.4.0] - 2026-07-22

### Security

- **PowerShell command injection fixed.** All user-supplied values are now escaped as
  single-quoted PowerShell literals via a new `quotePowerShellString` helper in
  `command-builder.ts` (and `prepareArgsString` in `utils.ts`). Previously values were
  interpolated with basic double-quote wrapping — or, in composite tools, not quoted at
  all — allowing `"`, `$`, backticks and `;` to break out and execute arbitrary commands.
  All composite tools that interpolated parameters directly (indexing, security ACL,
  archive, item clone, item referrer, layout, and rendering tools) now route those
  values through the escaper.
- `find-item` now escapes the free-text search `value` and `index`; `get-logs` restricts
  the `name` parameter to a safe filename charset (it is interpolated into a path glob
  that cannot be single-quoted).
- **GraphQL API key moved out of the URL.** The `sc_apikey` is now sent as an HTTP header
  instead of a query-string parameter in `query` and `introspection`, so it is no longer
  captured in access logs, proxies, or browser history.
- **Corrected the TLS-verification environment variable.** `.env.template` now uses the
  Node-recognized `NODE_TLS_REJECT_UNAUTHORIZED`; the previous `NODE_REJECT_UNAUTHORIZED`
  was not recognized by Node and silently had no effect. It still ships set to `0`, since
  the server primarily targets local development against Sitecore/XM Cloud instances with
  self-signed certificates, but now carries a prominent warning to set it to `1` (or
  remove it) in production or on untrusted networks.
- Updated dependencies to resolve all known advisories — `npm audit` now reports
  **0 vulnerabilities** (previously 18, including 4 critical). Notably bumps
  `@modelcontextprotocol/sdk` to ^1.29.0 and patches transitive `fast-xml-parser`,
  `minimatch`, `brace-expansion`, `body-parser`, and others.

### Added

- **Tool annotations for every tool.** A `server.tool` wrapper (`tool-annotations.ts`)
  now infers `readOnlyHint`, `destructiveHint`, and a human-readable `title` from each
  tool's name, so MCP clients can distinguish safe reads from mutations and destructive
  operations. `run-powershell-script` is flagged destructive and open-world.
- **Request timeouts** on all outbound HTTP calls via a shared `fetchWithTimeout` helper
  (Item Service, GraphQL, and PowerShell clients). Defaults: 30s for REST/GraphQL, 60s
  for PowerShell; both configurable via `REQUEST_TIMEOUT_MS` / `POWERSHELL_TIMEOUT_MS`.
  (60s aligns with the tool-call timeout most AI agents enforce, so a longer default would
  only cause the agent to abort before this timeout fires.) The PowerShell default was
  later raised to 10 minutes in 1.4.2.
- **Traversal guard** in `get-item-descendants`: a visited-set for cycle protection and a
  configurable node cap (`DESCENDANTS_MAX_ITEMS`, default 5000) that reports truncation
  instead of exhausting memory on large or circular item trees.
- **Unit test suite** (`tests/unit/`) covering the PowerShell escaper and tool-annotation
  inference, runnable without a live Sitecore instance via `npm run test:unit`.
- **CI workflow** (`.github/workflows/ci.yml`) that type-checks, builds, bundles, runs the
  unit tests, and audits dependencies on every pull request and push to `main`.
- `npm run typecheck` script (`tsc --noEmit`).
- A `/health` liveness endpoint on the HTTP transports (`streamable-http` and `sse`) that
  returns `200 {"status":"ok"}`, plus Docker `HEALTHCHECK` directives for the Linux and
  Windows images that probe it. (The health check reports that the HTTP server is
  accepting requests — the appropriate signal for a container — rather than probing the
  OAuth discovery endpoint.)

### Changed

- **Migrated to TypeScript 7.** The SDK's generic `tool()` overloads made the `tsc` 5.x
  type-checker exhaust its heap across the ~140 registration call sites (the build did not
  complete even with an 8 GB heap). The TypeScript 7 native compiler type-checks the same
  code in under a second, so tool-registration functions use the SDK's `McpServer` type
  directly with no custom indirection. `tsconfig.json` was migrated for TS7:
  `moduleResolution` is now `"bundler"` and the removed `baseUrl` option was dropped (path
  aliases retained as `"@/*": ["./src/*"]`).
- **Migrated all tool registrations from the deprecated `server.tool()` to
  `server.registerTool()`.** The SDK deprecated `tool()` in favour of `registerTool()`;
  every registration now passes a config object (`{ description, inputSchema }`) and the
  `withInferredAnnotations` wrapper injects annotations into that config rather than as a
  positional argument. (Feasible now that the TypeScript 7 switch removed the overload-
  resolution heap blow-up that affected `tool()` and `registerTool()` alike.)
- Normalized all `McpServer` imports to the `.js` module specifier for consistency.
- Docker images pinned to **Node 24** (Linux previously floated on `node:lts-alpine`;
  Windows previously pinned Node 22), matching the CI Node version. `@types/node` bumped
  to ^24 to match the Node 24 runtime.
- Docker images that expose an HTTP port now default to the `streamable-http` transport.
- Tightened input validation on search/pagination parameters (bounded `page`/`pageSize`,
  non-empty search terms).
- `AUTORIZATION_HEADER` renamed to the correctly-spelled `AUTHORIZATION_HEADER` across
  config and `smithery.yaml`. The old misspelled name is no longer recognized.

### Fixed

- **Clearer errors when a rendering lookup finds nothing** (issue #62). The presentation
  tools that resolve a rendering via `Get-Rendering` before acting on it previously failed
  with the opaque PowerShell error "Cannot bind argument to parameter 'Instance' because it
  is null." — or, for the switch tools, silently did nothing — when the item/rendering/
  language/layout didn't match. A shared guard (`rendering-guard.ts`) now reports an
  actionable error (via `Write-Error`, which the SPE transport returns as a normal
  response rather than an opaque HTTP 500) naming what was searched for and pointing at
  `presentation-get-rendering-by-id` / `-by-path` to list the item's renderings. Applied to
  all ten affected tools: `set-rendering-by-id`/`-by-path`,
  `set-/get-/remove-rendering-parameter-by-id`/`-by-path`, and
  `switch-rendering-by-id`/`-by-path`.
- Corrected the server description typo "Modle Context Protocol" → "Model Context Protocol".
- Pinned `@antonytm/clixml-parser` to `^0.1.5` instead of the floating `latest` tag.
