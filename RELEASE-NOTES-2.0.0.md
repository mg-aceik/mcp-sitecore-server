# 2.0.0

A fourth API surface, a tool surface a third smaller per operation, on the v2 MCP SDK and
MCP protocol revision 2026-07-28.

This is a major release. **Read [Breaking changes](#breaking-changes) before upgrading** —
the SSE endpoint is gone and roughly half the tool names changed.

## Highlights

- **The v2 MCP TypeScript SDK, protocol revision 2026-07-28.** `@modelcontextprotocol/sdk`
  is replaced by `@modelcontextprotocol/server` + `@modelcontextprotocol/node`, and both
  transports serve the 2026-07-28 revision *and* the 2025 handshake from the same tool
  registrations — a client on either revision sees the same tools. Streamable HTTP is now
  stateless: no session map, no session IDs.
- **A fourth surface: the Sitecore Authoring and Management GraphQL API — 22 new tools.**
  The surface Sitecore supports for authoring writes, and the one that matters most on
  SitecoreAI: plain HTTP with an OAuth bearer token, so it needs neither SPE Remoting nor
  the Item Service and keeps working where both are switched off.
- **`tools/list` is 121 tools / 135,573 characters, down from 162 / 150,038 in 1.4.2** —
  ~3,700 fewer tokens on every turn, while *adding* the authoring, composition, media and
  account-serialization tools. Set `TOOL_PROFILE` or `TOOL_GROUPS` for the instance you
  actually run against and it drops much further: `no-spe` serves 33 tools / 41,168
  characters.
- **A composition set for building pages** — `add-rendering-to-placeholder` refuses a
  component the placeholder settings forbid, `get-allowed-components-by-placeholder` says
  what is allowed, `create-component-datasource` creates the datasource from the
  rendering's own template.
- **Three guide resources** (`guide://compose-page`, `guide://bulk-update`,
  `guide://diagnose-connection`) for the workflows the tools can perform but do not encode.
- **Several real security fixes.** See [Security](#security) — one of them changes a
  default bind address.

## Breaking changes

### The SSE endpoint is gone

`SSEServerTransport` was removed from the MCP specification and from the SDK.
`http://<host>:3001/sse` no longer exists, and neither does `/messages`.

**Migration:** change the client's server URL from `http://<host>:3001/sse` to
`http://<host>:3001/mcp`, and its transport type from "SSE" to "Streamable HTTP" — same
host, same port, one endpoint instead of two. `TRANSPORT=sse` still starts a server rather
than failing: it serves Streamable HTTP and says so on stderr, so a container keeps
listening while you repoint its clients. `npm start` now means Streamable HTTP.

### The `-by-id` / `-by-path` tool families are merged

99 tools were variants of 48 operations, differing only in how the caller named the item.
Each merged tool drops the suffix and takes optional `id` and `path`, requiring exactly one.
**The old names are gone and are not aliased.** Supplying both, or neither, is now an input
error naming the valid inputs, rejected before any PowerShell runs.

**Migration:** `common-get-item-field-by-id` → `common-get-item-field` with `id`;
`presentation-get-layout-by-path` → `presentation-get-layout` with `path`; and so on across
`common-*`, `presentation-*`, `security-*`, `indexing-*`, `item-service-get-item` and
`provider-get-item`. Parameter changes that came with it: the presentation tools that took
`itemId`/`itemPath` now take `id`/`path`; `database` is sent only when addressing by `id`,
since a path carries its own prefix.

### Twelve more families merged on the same principle

Where two tools differed only in a value, the value became an input — 26 tools become 13:

| Was | Now |
| --- | --- |
| `security-get-user-by-identity`, `-by-filter` | `security-get-user` (`identity` or `filter`) |
| `security-get-role-by-identity`, `-by-filter` | `security-get-role` |
| `security-get-domain-by-name` | `security-get-domain` (`name` optional) |
| `security-lock-item`, `security-unlock-item` | `security-set-item-lock` (`action`) |
| `security-protect-item`, `security-unprotect-item` | `security-set-item-protection` (`action`) |
| `security-export-user`, `-export-role` | `security-export-account` (`accountType`) |
| `security-import-user`, `-import-role` | `security-import-account` (`accountType`) |
| `security-add-item-acl`, `-set-item-acl`, `-clear-item-acl` | `security-set-item-acl` (`action: add \| replace \| clear`) |
| `indexing-suspend-`, `-stop-`, `-resume-search-index` | `indexing-set-search-index-state` (`action`) |
| `indexing-initialize-search-index`, `-search-index-item` | `indexing-rebuild-search-index` (item optional) |
| `presentation-get-layout-device`, `-get-default-layout-device` | `presentation-get-layout-device` (`name` optional) |
| `common-add-base-template`, `-remove-base-template` | `common-set-base-template` (`action`) |

### Tools removed

- **`indexing-remove-search-index-item`** — an index entry deleted by hand reappears on the
  next crawl. Use `indexing-rebuild-search-index`.
- **`item-service-run-stored-query`, `item-service-run-stored-search`** — both ran a saved
  definition item by GUID that no caller ever had to hand. Use `item-service-search-items`,
  `authoring-search` or `indexing-find-item`.
- **`sitecore-cli-documentation`, and the whole `sitecore-cli` tool group** — it served a
  stale documentation snapshot. Sitecore's own documentation MCP server answers the same
  questions against live docs. `TOOL_GROUPS` no longer accepts `sitecore-cli`.

### Runtime and dependencies

- **Node.js: `engines.node` is now `>=22`.** The v2 SDK does not support older runtimes and
  Node 20 reached end of life in April 2026. The published Docker images run Node 24.
- **zod 4.2 or later is required**, and is now a direct dependency. On zod 3 the first
  `tools/list` fails silently; on zod 4.0–4.1 every parameter description is dropped.
- **SDK packages changed.** No migration for clients. Anyone embedding this package's
  modules should note that `McpServer` and `CallToolResult` now come from
  `@modelcontextprotocol/server`.
- **The Smithery integration is removed** — `smithery.yaml` and the root `Dockerfile` are
  deleted. Neither was built by CI. Install with `npx @antonytm/mcp-sitecore-server@latest`
  or one of the Docker images.

### Response shapes

- **~33 item-returning PowerShell tools now return an identity projection** rather than the
  full CLIXML object graph. `fields` names what you want; **`full: true` restores the old
  behaviour**. This is the change most likely to affect a programmatic consumer parsing
  responses.
- **`common-get-archive-item` returns an envelope**, not a bare row list: `Archive`,
  `Total`, `Skip`, `First`, `Returned`, `Items`, with `first` defaulting to 100.
- **`indexing-find-item` returns a paging envelope** instead of a bare array.
- **Inferred `annotations.title` is gone from all but two tools.** A client that displayed
  the title now displays the tool name — the same words.

## New tools

**Authoring and Management GraphQL (22).** New settings: `AUTHORING_ENDPOINT` (defaults to
`ITEM_SERVICE_SERVER_URL` plus the fixed path, so it rarely needs setting),
`AUTHORING_CLIENT_ID`/`AUTHORING_CLIENT_SECRET`, or `AUTHORING_TOKEN` for a token you
already hold. Tokens are minted on demand, cached and renewed without attention.

- `authoring.core` — `authoring-introspect-schema`, `authoring-graphql`. Between them they
  reach the *entire* schema, including the ~107 of 127 operations no typed tool wraps.
- `authoring.content` — get / create / update / delete / copy / move / rename item, search,
  the item-template trio, `authoring-upload-media`, `authoring-get-media-item`,
  `authoring-list-sites`, `authoring-get-site`.
- `authoring.management` — `authoring-publish-item`, `authoring-publishing-status`,
  `authoring-rebuild-indexes`, `authoring-get-job`, `authoring-list-jobs`.

**Composition** — `add-rendering-to-placeholder`, `get-allowed-components-by-placeholder`,
`create-component-datasource`, `list-sites`, `get-site-information`,
`list-site-components`, `get-pages-by-site`, `search-site-pages`, `list-insert-options`.

**Media** — `media-upload` and `media-download`, over the SPE `mediaUpload` /
`mediaDownload` handlers. Both need those services enabled on the CM; the setup doc's patch
now ships them enabled.

**Presentation** — `presentation-list-renderings` reads a page's presentation as addressable
rows rather than a layout XML blob.

**Security** — `security-export-account` / `security-import-account`, unblocked by SPE 8.0.

## Security

- **Streamable HTTP validates `Host` and `Origin`, and binds loopback by default.** DNS
  rebinding lets a browser page treat whatever is listening on `127.0.0.1` as same-origin —
  on this server that is administrative control of the configured Sitecore instance, since
  `AUTHORIZATION_HEADER` is empty by default. Both headers are now checked ahead of every
  route and ahead of body parsing.

  ⚠️ **`HOST` now defaults to `127.0.0.1` rather than every interface.** A non-container
  deployment that relied on the old all-interfaces default must set `HOST` explicitly. The
  container images set `HOST=0.0.0.0` themselves, because a published container port cannot
  reach the container's own loopback — what the port is exposed to is still decided by the
  `-p` mapping. Deployments reached by a name of their own list it in `MCP_ALLOWED_HOSTS`.

- **The `config` tool and `config://main` resource redact secrets.** Both used to return the
  Item Service and PowerShell passwords, the GraphQL API key and the server's own
  `AUTHORIZATION_HEADER` to any client that could call a tool.

- **`filePath` and `saveTo` are refused over the HTTP transport by default** — arbitrary
  file read/write for anyone who can reach the port. Set `MEDIA_LOCAL_FILE_ROOT` to allow
  them, confined to that directory.

- **`sourceUrl` cannot reach private networks** — only `http`/`https`, and hostnames
  resolving into private, loopback or link-local space are refused unless
  `MEDIA_ALLOW_PRIVATE_SOURCE_URL=true`. Revalidated on every redirect hop.

- **The authorization check is constant-time and the `Bearer` strip is anchored.**

## Performance and token cost

- `get-powershell-documentation` **reveals the SPE reference progressively** instead of
  returning all 148 pages (~570KB) in one result: no arguments returns a ~13KB index,
  `search` matches bodies, `command` returns up to five full pages. The 19 console-only
  command pages are no longer bundled — over remoting there is no browser, so pages for
  `Show-Confirm` and friends described a capability the agent does not have.
- `introspection-graphql-{schema}` **returned 777,501 characters** against a live Edge
  endpoint — more than most context windows hold. With no arguments it now returns 3,950;
  `type:` returns one type in full; `includeDescriptions: false` cuts the full SDL to
  234,980.
- `authoring-introspect-schema` returns a 10,332-character operation index, down from
  117,188.
- `item-service-search-items` no longer returns the facet breakdown unless asked — it was
  46,014 of a 62,277-character response. Pass `includeFacets: true`.
- Sixteen further tools project their responses: `common-get-cache` 110,299 → 26,332,
  `common-get-sitecore-job` 42,018 → 8,920, `common-new-item-clone` 59,587 → 270,
  `common-get-database` 21,761 → 642, and more. Every one takes `full: true`.
- **Tool gating** via `TOOL_GROUPS`, `DISABLED_TOOLS` and `TOOL_PROFILE` — five presets,
  comma-separated and composable. Four name an absent API surface (`no-spe`,
  `no-item-service`, `no-edge-graphql`, `no-authoring-api`); `no-account-management` hides
  twelve consequential account tools that work on any CM. See
  [Tool selection](https://github.com/Antonytm/mcp-sitecore-server/blob/main/docs/tool-selection.md).

## Bug fixes

Selected — see the [changelog](https://github.com/Antonytm/mcp-sitecore-server/blob/main/CHANGELOG.md) for all of them.

- **`get-powershell-documentation` was broken in the published package.**
- **`prepare` did not produce `dist/bundle.js`**, which `main` and `bin` point at.
- **`express` was declared as a devDependency** but kept external by rollup.
- **The `/mcp` body limit was Express's 100kb default** — smaller than a media upload.
- **`indexing-find-item` failed outright when two criteria named the same field**, and
  reported a failed search as an empty one.
- **`query-graphql-<schema>` sent `variables` as a string**, and claimed `readOnlyHint`
  while forwarding any document including mutations.
- **`presentation-set-rendering` could never find a rendering that lives on the final
  layout**; the rendering-instance tools now default `finalLayout` to `true`.
- **`presentation-switch-rendering` returned nothing**, though the switch assigns a new
  `uniqueId` — every follow-up call was aimed at an id that no longer existed.
- **`media-upload` reported success when it had stored nothing.**
- **`common-publish-item`'s `fromDate` was declared `z.date()`**, which zod 4 cannot
  represent in JSON Schema.
- **Five tools passed parameters SPE's cmdlets do not define**, so any call using them
  failed.
- **`security-set-user-password` failed whenever it was called the way its own description
  suggested**, and `security-*-item-acl` offered a propagation type that does not exist.
- **A malformed `GRAPHQL_HEADERS` killed the process during module import**; an
  unrecognised `TRANSPORT` fell through to stdio in silence.
- **A non-JSON response from the CM was reported as a parse bug** rather than as the
  identity-provider redirect or missing remoting service it usually is. `Login failed` now
  carries the status and the reason.

## Also in this release

- **ESLint**, a live test suite that seeds and cleans up its own content, and the version
  now stated once in `package.json` and derived everywhere else.
- **Fixed: both Docker images failed to build** — neither Dockerfile copied `scripts/`,
  which `npm run build` needs.

## Install

```shell
npx @antonytm/mcp-sitecore-server@latest
```

```shell
docker run --rm -p 127.0.0.1:3001:3001 --env-file .env antonytm/mcp-sitecore-linux:2.0.0
```

Docs: [Configuration](https://github.com/Antonytm/mcp-sitecore-server/blob/main/docs/configuration.md)
· [Tools](https://github.com/Antonytm/mcp-sitecore-server/blob/main/docs/tools.md)
· [Tool selection](https://github.com/Antonytm/mcp-sitecore-server/blob/main/docs/tool-selection.md)
· [Sitecore setup](https://github.com/Antonytm/mcp-sitecore-server/blob/main/docs/sitecore-setup.md)

**Full changelog:** https://github.com/Antonytm/mcp-sitecore-server/compare/1.4.2...2.0.0
