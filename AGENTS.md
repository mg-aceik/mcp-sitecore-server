# mcp-sitecore-server

An MCP server (`@antonytm/mcp-sitecore-server`) that gives agents read/write access to
Sitecore over four independent API **surfaces**: the **Authoring and Management GraphQL
API**, the **Item Service** (REST/SSC), **GraphQL Edge/preview**, and **Sitecore PowerShell
Extensions (SPE) remoting**. It targets both SitecoreAI and XM/XP, so treat every surface as
optional and let the gating decide — see tool gating below.

## Tests

`package.json` holds the scripts. Two things it does not say:

- `npm run test:unit` needs no Sitecore instance and should always pass. `npm test` builds,
  bundles and runs the full suite, which **requires a live seeded instance**.
- The `--config vitest.unit.config.ts` flag matters: only that config maps the `@/` alias
  and scopes to `tests/unit`. The bare `vitest.config.ts` is the integration config.

```shell
npx vitest run --config vitest.unit.config.ts tests/unit/projection.test.ts
npx vitest run --config vitest.unit.config.ts -t "name of the case"
```

The full suite addresses seeded fixture content by hard-coded GUID on one specific demo
instance, so read the failure signature before blaming a change: `Unexpected token 'G',
"Get-Item …"` means the fixture content is missing (SPE returned its own error text, not
JSON); `rejected its arguments before reaching Sitecore` means the test's arguments don't
match the schema; `Login failed: 403` / `came from Auth0` is configuration.

Runtime config comes from `.env` (copy `.env.template`). CI runs typecheck+build, bundle,
unit tests, and a non-blocking `npm audit`.

## Architecture

**Startup:** `index.ts` reads `TRANSPORT` and calls `stdio.ts` or `streamable-http.ts`;
both build the server via `server.ts:getServer(config)`. (`src/run.ts`, behind `npm run
run`, is a scratch harness for poking the PowerShell client — not an entry point.)
`config.ts` parses env into a `Config` at import time and exports `redactConfig` — every
path that exposes config to a client (the `config` tool, the `config://main` resource) must
go through it.

**Registration pipeline** (`register.ts`): `TOOL_GROUP_REGISTRARS` maps each group name to
an ordered list of registrar functions `(server, config) => void`. `registerAll` skips
whole groups when gated, so a disabled group also skips its registrars' startup cost
(schema introspection, index lookups). Adding a tool = write the registrar, import it, add
it to its group's array.

**Tool gating** (`tool-profiles.ts`): `TOOL_GROUPS` (allowlist of groups), `DISABLED_TOOLS`
(denylist of exact names), `TOOL_PROFILE` (named `no-*` presets, unioned; denylist wins).
Gating is installed on the server *before* the first `registerTool`, and
`registerGuides` is gated on the same object so every offered guide has the tools its
steps name. The group names are the directory layout under `src/tools/`,
not a separate taxonomy.

**Guides** (`src/guides/`): three procedures served as `guide://` resources by
`register-guides.ts` (`COMPOSE_PAGE_GUIDE` → `guide://compose-page`, `BULK_UPDATE_GUIDE` →
`guide://bulk-update`, `DIAGNOSE_CONNECTION_GUIDE` → `guide://diagnose-connection`). Each
one's steps name real tools, so a guide and its tools are gated together. Two rules:

- **Resources, not prompts.** These were registered as prompts too and no longer are: the
  failures they guard surface mid-task, several calls in, when a one-shot prompt injection
  can no longer be consulted. Do not add the prompts back — the server deliberately
  advertises no prompts capability, and a test asserts `prompts/list` is empty.
- **A guide is only as good as its pointer.** A client lists resources separately from
  tools and an agent has no reason to go looking, so each URI is named in
  `TOOL_SELECTION_GUIDE` *and* in the description of the tool it is about
  (`add-rendering-to-placeholder` → compose-page, `run-powershell-script` → bulk-update),
  which is where an agent already partway through a task meets it. Renaming a URI means
  fixing those descriptions; a test asserts both.

**Annotations** (`tool-annotations.ts`): `withInferredAnnotations(server)` wraps
`registerTool` and derives `readOnlyHint`/`destructiveHint` from the hyphen-delimited
tokens of the tool name. Add a new mutating verb to `WRITE_TOKENS` or `DESTRUCTIVE_TOKENS`,
or the tool silently advertises itself as a safe read. A tool may set `annotations`
explicitly to override. No `title` is inferred, deliberately.

**Agent-facing guidance** (`tool-guide.ts`): `ROUTING_INSTRUCTIONS` goes into the
`initialize` instructions (paid every session — keep it short); `TOOL_SELECTION_GUIDE` is
served as the `guide://tool-selection` resource (free until read). Both are string
constants, never file reads: `package.json`'s `files` ships `dist` only, so `docs/` does
not exist for npx users. `docs/tool-selection.md` is the human counterpart of the same
material — it covers the environment variables, which the agent's copy leaves out.

**Context economy is a first-class concern here.** Tool descriptions, schemas and results
are paid on every turn, and much of the code exists to bound them: `powershell/projection.ts`
appends `Select-Object` projections so Sitecore trims before CLIXML serializes (measured
before/after sizes are recorded in its header comment); `graphql/schema-slice.ts` and
`authoring/logic/introspection-query.ts` serve schema slices instead of full SDL;
`powershell/documentation-index.ts` reveals the vendored SPE command reference in three
widening steps. A `full: true` parameter is the escape hatch that disables this. Weigh that
cost before adding descriptions or fields, and measure before you project.

### Per-surface layers

- **PowerShell** (`src/tools/powershell/`) — the largest surface. `client.ts` (auth +
  CLIXML), `command-builder.ts` (parameter rendering + `quotePowerShellString`),
  `simple/generic.ts:runGenericPowershellCommand` (the single funnel: builds, runs, parses,
  shapes errors), `error-shaping.ts`, `projection.ts`, `utils.ts` (shared parameter schemas
  and reused descriptions). `simple/` wraps one cmdlet; `composite/` orchestrates several
  or adds validation (e.g. `composition/add-rendering-to-placeholder` refuses components
  the placeholder settings forbid). `documentation/` is a verbatim vendored copy of the SPE
  Book, copied into `dist/` by both `scripts/copy-docs.mjs` and the rollup copy plugin.
- **Authoring** (`src/tools/authoring/`) — `client.ts` (OAuth bearer), `logic/run.ts`
  (the funnel every typed tool goes through, so results share one shape),
  `logic/selections.ts` (shared GraphQL selection sets; the endpoint rejects documents
  deeper than 13 levels), `tools/*.ts` grouped as core / content / management by
  `register-authoring.ts`.
- **Item Service** (`src/tools/item-service/`) — `logic/` holds the calls, `tools/` the
  registrations, each split `simple/` vs `composite/`.
- **GraphQL Edge** (`src/tools/graphql/`) — registers a query tool and an introspection
  tool per entry in `GRAPHQL_SCHEMAS`, so the tool count varies with config.

## Conventions

- **ESM + path alias.** `"type": "module"`, `verbatimModuleSyntax`; relative imports must
  carry the `.js` extension. `@/*` maps to `src/*`, resolved by `tsc-alias` at build, by
  the rollup alias plugin when bundling, and by `vitest.unit.config.ts` in tests.
- **Tool naming** is `<group>-<verb>-<noun>`, and the file lives in the directory matching
  its group.
- **Item addressing:** one tool per operation, addressed by argument. A tool acting on an
  item takes optional `id`/`path` (plus `uniqueId`/`query`/`uri` where the family had them)
  and validates with `requireOneTarget` / `requireAtMostOneTarget` from
  `src/tools/target-input.ts` *before* anything reaches Sitecore. Branch on
  `hasTarget(value)`, which separates an absent target from an empty string. Keep the
  `-by-id` / `-by-path` variants retired.
- **PowerShell escaping is a command-injection boundary**, not a style preference: every
  user-supplied value interpolated into a script goes through `quotePowerShellString` or
  `prepareArgsString`.
- **Errors the agent can act on are returned, not thrown.** Return an `isError: true`
  `CallToolResult` naming the fix; a throw gets wrapped by `safeMcpResponse` in "Error
  executing tool:", which reads like a server fault. The `describeFailed*Response` helpers
  exist because a bare status code misdiagnoses the common cases (an identity-provider
  redirect, a missing remoting service).
- **Bad configuration is reported on stderr and degraded past**, never thrown — a throw
  during module import kills a stdio server with nothing to show the user. See
  `parseGraphQLHeaders`, the `TRANSPORT` transform, and unknown `TOOL_PROFILE` names.
- **zod 4.2+ is required.** Schemas are converted to JSON Schema by the SDK; on zod 3 the
  first `tools/list` fails silently, and on 4.0–4.1 every parameter description is dropped.
- Comments here explain *why*, usually citing a measured number or a live-endpoint quirk.
  Match that when touching these files, and carry the reasoning forward when you edit.

## Security-sensitive spots

`http-guards.ts` (Host/Origin validation against DNS rebinding, `MCP_ALLOWED_HOSTS`),
`streamable-http.ts` (binds `127.0.0.1` by default, `timingSafeEqual` bearer comparison,
32mb body cap), `redactConfig`, and the PowerShell quoting boundary above. Changes to any
of these want a matching unit test — `tests/unit/http-guards.test.ts` is the model.

## Docs

Ship the docs change in the same PR as the code change.

- **Adding or changing a tool** — `docs/tools.md` needs the entry, `CHANGELOG.md` the line.
  Tool counts appear in `README.md`, `tool-profiles.ts` and the docs; keep them consistent.
- **Writing a `CHANGELOG.md` entry** — check whether the top version has shipped before you
  open a new one. `npm view @antonytm/mcp-sitecore-server versions` is the source of truth;
  when it does not list the version in `package.json`, that release is still in flight and
  your line belongs under its existing heading.
- **Changing gating, groups or profiles** — `docs/tool-selection.md`.
- **Adding or renaming an environment variable** — `docs/configuration.md`, `.env.template`.
- **Requiring something new of the instance** (a service to enable, a config patch) —
  `docs/sitecore-setup.md`.
- **Changing a transport, port or image** — `docs/running.md`, `docs/docker.md`.
- **Changing a guide** — `docs/guides.md`.
- `README.md` stays short (install plus pointers); detail belongs in `docs/`.
