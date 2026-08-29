# Sitecore Community MCP

[![Build](https://github.com/antonytm/mcp-sitecore-server/actions/workflows/publish-npm.yml/badge.svg)](https://github.com/Antonytm/mcp-sitecore-server/actions/workflows/publish-npm.yml) [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

This repository contains the source code for the Sitecore Community MCP server — an
open-source [Model Context Protocol](https://modelcontextprotocol.io) server that gives AI
agents direct read/write access to Sitecore, so you stop copy-pasting between your agent
and the Content Editor.

- **121 tools** across search, query, create, read, update, delete, media, PowerShell, logging, security and presentation
- Covers four Sitecore API surfaces: the **Authoring and Management GraphQL API**, the **Item Service**, **GraphQL Edge** and **Sitecore PowerShell Extensions**
- Works with **SitecoreAI** and **Sitecore XM/XP** (all versions), from any MCP-compatible client
- Implements **MCP protocol revision 2026-07-28**, and answers the 2025 `initialize` handshake from the same tool registrations
- Reported impact: **5× faster** Figma-to-Sitecore workflows and **~70% less** manual scaffolding ([case study](https://exdst.com/case-studies/sitecore-mcp))
- Three ways to run it: **npm**, **Docker**, or from source

## Getting started with Sitecore Community MCP

To run the Sitecore Community MCP server, you need:

- Node — the latest long-term support (LTS) release.
- A Sitecore XM, XP or SitecoreAI instance. Which parts you enable decides which tools
  work: the `authoring.*` groups need only the Authoring and Management API (normally
  already on in the cloud) plus a token, while the Item Service and SPE Remoting are off by
  default and need a config patch. [Preparing your Sitecore instance](docs/sitecore-setup.md)
  covers all three and how to verify each.

### Adding the server to your MCP client

Add the entry below to your client's server map — `mcpServers` in Cursor, Claude Code and
most other clients, `servers` in VS Code — and fill in your own endpoints and credentials:

```json
{
  "mcpServers": {
    "sitecore-mcp": {
      "type": "stdio",
      "command": "npx",
      "args": ["@antonytm/mcp-sitecore-server@latest"],
      "env": {
        "TRANSPORT": "stdio",
        "GRAPHQL_ENDPOINT": "https://xmcloudcm.localhost/sitecore/api/graph/",
        "GRAPHQL_SCHEMAS": "edge",
        "GRAPHQL_API_KEY": "{6D3F291E-66A5-4703-887A-D549AF83D859}",
        "GRAPHQL_HEADERS": "",
        "ITEM_SERVICE_DOMAIN": "sitecore",
        "ITEM_SERVICE_USERNAME": "admin",
        "ITEM_SERVICE_PASSWORD": "b",
        "ITEM_SERVICE_SERVER_URL": "https://xmcloudcm.localhost/",
        "POWERSHELL_DOMAIN": "sitecore",
        "POWERSHELL_USERNAME": "admin",
        "POWERSHELL_PASSWORD": "b",
        "POWERSHELL_SERVER_URL": "https://xmcloudcm.localhost/",
        "AUTHORING_CLIENT_ID": "",
        "AUTHORING_CLIENT_SECRET": "",
        "TOOL_PROFILE": ""
      }
    }
  }
}
```

`TOOL_PROFILE` takes a comma-separated list of presets, and unions what each one hides.
Every preset names something absent or unwanted rather than a platform. Four name an API
surface your instance does not serve — **`no-spe`**, **`no-item-service`**,
**`no-edge-graphql`** and **`no-authoring-api`** — so an instance missing two of them can
say so. **`no-account-management`** is the one that is not about a missing surface: it
hides the twelve tools that create or edit an account on the CM, for a deployment that
would rather an agent could not do that at all (item security, and reading accounts and
roles, are untouched):

```
TOOL_PROFILE=no-spe,no-item-service
```

`no-spe` is the big one: without SPE installed and its `remoting` service enabled, roughly
three quarters of this server's tools cannot run, and hiding them is schema an agent no
longer pays for on every turn. An unknown name is reported on stderr and ignored, leaving
the rest of the list in force.

Every setting is documented in [Configuration](docs/configuration.md). Agents have a limit
on how many tools they can hold, so before you get far, read
[Tool selection](docs/tool-selection.md) and trim the surface with `TOOL_PROFILE`,
`TOOL_GROUPS` and `DISABLED_TOOLS`.

To run the server in a container or from source instead, see
[Running the server](docs/running.md).

## How this compares to the Sitecore Marketer MCP

Sitecore's own [Marketer MCP](https://doc.sitecore.com/sai/en/users/sitecoreai/sitecore-marketer-mcp-server.html) is a hosted service aimed
at marketers on SitecoreAI. This server is the developer-grade counterpart, and on that
ground it is the stronger tool:

|                   | Sitecore Community MCP                                                                                                                            | Sitecore Marketer MCP                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **Platforms**     | SitecoreAI **and** XM/XP, all versions — including your local Docker CM                                                                           | SitecoreAI only                                                                        |
| **Hosting**       | Self-hosted (npm, Docker, source); credentials never leave your infrastructure                                                                    | Hosted by Sitecore; OAuth through the cloud                                            |
| **Surface**       | 121 tools across the full developer surface: items, templates, presentation, media, security, indexing, logs, publishing, GraphQL, raw PowerShell | Marketer operations: pages, components, briefs, brand kits, personalization, A/B tests |
| **Escape hatch**  | `run-powershell-script`, raw Edge GraphQL and raw Authoring GraphQL — if a tool doesn't exist, the capability still does                          | Closed tool set                                                                        |
| **Layout safety** | `add-rendering-to-placeholder` _refuses_ components the placeholder settings forbid, naming the allow-list                                        | Writes are not validated against placeholder settings                                  |
| **Tool gating**   | `TOOL_GROUPS` / `DISABLED_TOOLS` / `TOOL_PROFILE` trim the schema cost per turn                                                                   | Fixed tool list                                                                        |

They are complementary rather than exclusive: the Marketer MCP carries the cloud marketing
features this server has no API for (briefs, brand kits, personalization variants, A/B
tests), and nothing stops a client from connecting both. For building, migrating, auditing
and operating Sitecore solutions, this server is the one with the depth.

## Documentation and community resources

- [Preparing your Sitecore instance](docs/sitecore-setup.md) — SPE Remoting, the Item Service, GraphQL keys, and the config patch that enables them
- [Running the server](docs/running.md) — npm, Docker, from source, and the two transports
- [Tool reference](docs/tools.md) — every tool, grouped by API surface
- [Configuration](docs/configuration.md) — environment variables, transports, timeouts and TLS
- [Tool selection](docs/tool-selection.md) — `TOOL_GROUPS`, `DISABLED_TOOLS` and `TOOL_PROFILE`
- [Docker images](docs/docker.md) — the published Linux and Windows images
- [Changelog](CHANGELOG.md) — what's new in 2.0 and its breaking changes

Community resources:

- [Model Context Protocol specification](https://modelcontextprotocol.io/specification/)
- [Sitecore PowerShell Extensions documentation](https://doc.sitecorepowershell.com/)
- [Sitecore Stack Exchange](https://sitecore.stackexchange.com/)
- [Sitecore Community Slack](https://sitecorechat.slack.com)
- [Sitecore Community Forum](https://community.sitecore.net/developers/f/40)

## Contributions

We are very grateful to the community for contributing bug fixes and improvements. We
welcome all efforts to evolve and improve this server; read below to learn how to
participate in those efforts.

### [Contributing Guide](CONTRIBUTING.md)

Read our [contributing guide](CONTRIBUTING.md) to learn about our development process, how
to propose bug fixes and improvements, and how to build, debug and test your changes.

### License

Sitecore Community MCP is using the [Apache 2.0 license](LICENSE).

## Support

This is a community project and is not supported by Sitecore.

- **Issues, bugs and feature requests:** open an issue at
  [Antonytm/mcp-sitecore-server/issues](https://github.com/Antonytm/mcp-sitecore-server/issues).
- **Questions about Sitecore itself:** [Sitecore Stack Exchange](https://sitecore.stackexchange.com/)
  or the [Sitecore Community Slack](https://sitecorechat.slack.com) will serve you better
  than a GitHub issue.
