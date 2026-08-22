# Contributing to Sitecore Community MCP

Want to contribute to the Sitecore Community MCP server? There are a few things you need
to know.

## Pre-requisites

- `node.js` — version 20 or later (`node -v` to test). We develop on 22; 20 is the minimum
  the MCP SDK supports.
- `npm` (`>= 10`) installed (`npm -v` to test).
- A Sitecore XM, XP or SitecoreAI instance with SPE Remoting and the Item Service
  enabled — see [Preparing your Sitecore instance](docs/sitecore-setup.md).

## Developing

See [Branching overview](#branching-overview) below — we use `main` for our current
development.

1. [Fork](https://help.github.com/articles/fork-a-repo/) this repository to your own
   GitHub account and then [clone](https://help.github.com/articles/cloning-a-repository/)
   it to your local device.
2. Create a new branch, e.g. `git switch -c feature/my-mcp-feature`.
3. When you're happy with your changes, open a Pull Request targeting the `main` branch of
   the `Antonytm/mcp-sitecore-server` repository.
4. Note: CI type-checks, builds, bundles, runs the unit tests and audits dependencies on
   every pull request. Please make sure these pass or your PR can not be merged.

## Setting up

From the root of the repository:

- `npm install` — installs dependencies.
- `npm run build` — compiles TypeScript to `dist/` and rewrites path aliases.
- `npm run bundle` — produces the published single-file `dist/bundle.js` via rollup.
- `npm run typecheck` — type-checks without emitting.

Copy [`.env.template`](.env.template) to `.env` and point it at your Sitecore instance.
Every setting is documented in [Configuration](docs/configuration.md).

Running the server locally:

```shell
npm start           # builds, then serves Streamable HTTP on port 3001 at /mcp
npm run start:stdio # builds, then serves stdio
```

## Debugging

There is no SSE endpoint any more — the MCP SDK removed the SSE transport, so the server
speaks Streamable HTTP or stdio.

Over stdio, `npm run inspector` does the whole job: it launches the inspector with
`node dist/index.js` as the server, which defaults to stdio.

Over Streamable HTTP:

1. Run `npm start` to build the project and start the server. It listens on port 3001 and
   serves Streamable HTTP at `/mcp`.
2. Run `npx @modelcontextprotocol/inspector@latest` with no server arguments.
3. Open the inspector at `http://127.0.0.1:6274/#resources`, choose the *Streamable HTTP*
   transport and connect to `http://localhost:3001/mcp`.

Either way, the inspector lets you see the requests and responses between the client and
the server. Run these commands in a *JavaScript Debug Terminal* in VS Code to be able to
debug the code.

## Code style guidelines

There are a few coding guidelines worth mentioning here that will cause less friction when
trying to get a PR merged.

- **TypeScript:** make sure everything has the appropriate type. The build runs on
  TypeScript 7; tool-registration functions use the SDK's `McpServer` type directly.
- **Tool naming:** tools are named `<group>-<verb>-<noun>` and live under the directory
  that matches their group — the groups in
  [Tool selection](docs/tool-selection.md) are the directory layout, not a separate
  taxonomy.
- **Item addressing:** a tool that acts on an item takes optional `id` and `path` and
  requires exactly one, validated before anything reaches Sitecore. Don't reintroduce
  `-by-id` / `-by-path` variants.
- **PowerShell escaping:** every user-supplied value interpolated into a script must go
  through `quotePowerShellString` (or `prepareArgsString` in `utils.ts`). This is a
  command-injection boundary, not a style preference.

## Run unit tests

To keep everything running smoothly, please include unit tests when applicable. The unit
suite needs no Sitecore instance:

```shell
npm run test:unit
```

## Run integration tests

The full suite runs against a live Sitecore instance. The Sitecore Demo website is used
for testing.

**TODO:** it will be added as a submodule in the future. It is not added yet because we
have doubts that we need so complex a setup for testing.

1. Clone <https://github.com/exdst/Sitecore.Demo.XMCloud.Verticals/tree/feature/mcp-playground>.
2. Use branch `feature/mcp-playground`.
3. Follow the instructions in the repository to set up the environment:
   1. Run `.\init.ps1 -InitEnv` to initialize the environment.
   2. Run `.\up.ps1` to start the environment.
4. Log in to the Sitecore instance.
5. Run `npm run build` to build the project.
6. Run `npm test` to run the tests.

## Documentation

The README is deliberately short: it covers installation, a pointer to each doc, and how
to contribute. Detail belongs in [`docs/`](docs) —
[tools.md](docs/tools.md) for the tool reference,
[configuration.md](docs/configuration.md) for environment variables,
[tool-selection.md](docs/tool-selection.md) for tool gating,
[sitecore-setup.md](docs/sitecore-setup.md) for the Sitecore-side prerequisites,
[running.md](docs/running.md) for the ways to start the server and
[docker.md](docs/docker.md) for the images. A new tool needs an entry in
[tools.md](docs/tools.md) and a [CHANGELOG](CHANGELOG.md) line in the same PR.

# Troubleshooting

Problem: the build fails with `cannot find module ...`

Solution: if dependencies changed, you may need to reinstall them. From the root of the
repository:

```shell
npm install
```

Problem: `tools/list` returns nothing, or parameter descriptions are missing.

Solution: check your installed `zod` version. The server builds tool schemas with zod's own
JSON Schema conversion and requires **zod 4.2 or later** — on zod 3 the first `tools/list`
fails silently, and on zod 4.0–4.1 every parameter description is dropped.

# Branching overview

- `main` — latest changes for the next release
- `feature/*` — work in progress, opened as a PR against `main`
