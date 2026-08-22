# Model Context Protocol server for Sitecore

[![Build](https://github.com/antonytm/mcp-sitecore-server/actions/workflows/publish-npm.yml/badge.svg)](https://github.com/Antonytm/mcp-sitecore-server/actions/workflows/publish-npm.yml)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![smithery badge](https://smithery.ai/badge/@Antonytm/mcp-sitecore-server)](https://smithery.ai/server/@Antonytm/mcp-sitecore-server)

## Summary

An open-source Model Context Protocol server that gives AI agents (Claude, ChatGPT, Cursor, and others) direct read/write access to Sitecore. It bridges the gap between modern AI-driven workflows and Sitecore CMS, eliminating manual copy-paste between tools.

- **100+ tools** across search, query, create, read, update, delete, PowerShell, logging, security, and presentation
- Covers multiple Sitecore API surfaces: **Item Service**, **GraphQL Edge**, and **Sitecore PowerShell Extensions**
- Works with **Sitecore AI (XM Cloud)** and **Sitecore XM/XP** (all versions), and with any MCP-compatible client via JSON-RPC
- Reported impact: **5× faster** Figma-to-Sitecore workflows and **~70% less** manual scaffolding (see [case study](https://exdst.com/case-studies/sitecore-mcp))
- Three ways to run it: **NPM**, **Docker**, or from source

## Implemented tools

Most tools that act on an item take **`id` or `path`**, and exactly one of them must be
supplied — supplying both, or neither, is an input error that names the valid inputs and
never reaches Sitecore. Some take a wider union: `provider-get-item` also accepts `query`
and `uri`, and `presentation-switch-rendering` names the rendering to replace with
`oldRenderingId`, `oldRenderingPath` or `uniqueId`. A tool that addresses two things at
once (an item *and* a rendering, placeholder setting or layout) validates each
independently. `database` is only sent when addressing by id: a path carries its own
prefix, as in `master:/sitecore/content/Home`.

Before v1.5.0 these were separate `-by-id` / `-by-path` tools. See
[`CHANGELOG.md`](CHANGELOG.md) for the old-to-new name mapping.

- [x] GraphQL API
  - [x] `introspection-grahpql-{schema}`: returns the GraphQL schema
  - [x] `query-graphql-{schema}`: executes a GraphQL query
- [x] Item Service API
  - [x] `item-service-get-item`: returns an item, addressed by `id` or `path`
  - [x] `item-service-get-item-children`: returns the children of an item by ID
  - [x] `item-service-create-item`: creates an item by providing a template ID and parent path.
  - [x] `item-service-edit-item`: edits an item by ID
  - [x] `item-service-delete-item`: deletes an item by ID
  - [x] `item-service-search-items`: searches for items
  - [x] `item-service-run-stored-query`: runs a stored query
  - [x] `item-service-run-stored-search`: runs a stored search
  - [x] Composite Item Service API
    - [x] `item-service-get-languages`: returns Sitcore languages in the instance
    - [x] `item-service-get-item-descendants`: returns the descendants of an item by ID
- [ ] Sitecore Powershell
  - [x] `get-powershell-documentation`: returns the documentation describing all Sitecore Powershell commands
  - [x] `run-powershell-script`: runs a PowerShell script and returns the output
  - [ ] Security
    - [x] `security-get-current-user`: returns the current user
    - [x] `security-get-user-by-identity`: returns a user by name
    - [x] `security-get-user-by-filter`: returns a user by filter
    - [x] `security-new-domain`: creates a new domain
    - [x] `security-new-user`: creates a new user
    - [x] `security-new-role`: creates a new role
    - [x] `security-remove-domain`: removes a domain
    - [x] `security-remove-user`: removes a user
    - [x] `security-remove-role`: removes a role
    - [x] `security-get-domain`: returns a domains
    - [x] `security-get-domain-by-name`: returns a domain by name
    - [x] `security-get-role-by-identity`: returns a role by name
    - [x] `security-get-role-by-filter`: returns a role by filter
    - [x] `security-get-role-member`: returns members of a role
    - [x] `security-enable-user`: enables a user
    - [x] `security-disable-user`: disables a user
    - [x] `security-set-user-password`: changes a user's password
    - [x] `security-lock-item`: locks an item
    - [x] `security-unlock-item`: unlocks an item
    - [x] `security-protect-item`: protects an item
    - [x] `security-unprotect-item`: unprotects an item
    - [x] `security-test-acccount`: tests an account
    - [x] `security-unlock-user`: unlocks a user
      - [ ] test covergage requires logging user with wrong password
    - [ ] `security-login-user`: logs in a user. Blocked by [SPE issue](https://github.com/SitecorePowerShell/Console/issues/1367#issue-3055272174).
    - [ ] `security-logout-user`: logs out a user. Blocked by [SPE issue](https://github.com/SitecorePowerShell/Console/issues/1368)
    - [ ] `security-export-user`: exports a user. Blocked by [SPE issue](https://github.com/SitecorePowerShell/Console/issues/1370)
    - [ ] `security-import-user`: imports a user. Blocked by [SPE issue](https://github.com/SitecorePowerShell/Console/issues/1371)
    - [ ] `security-export-role`: exports a role. Blocked by [SPE issue](https://github.com/SitecorePowerShell/Console/issues/1369)
    - [ ] `security-import-role`: imports a role. Blocked by [SPE issue](https://github.com/SitecorePowerShell/Console/issues/1372)
    - [x] `security-add-role-member`: adds a member to a role
    - [x] `security-remove-role-member`: removes a member from a role
    - [x] `security-test-item-acl`: tests an item ACL
    - [x] `security-add-item-acl`: adds an item ACL
    - [x] `security-clear-item-acl`: clears an item ACL
    - [x] `security-set-item-acl`: sets an item ACL
  - [x] Provider
    - [x] `provider-get-item`: returns an item, addressed by `id`, `path`, `query` or `uri`
  - [x] Presentation
    - [x] `presentation-get-layout`: returns the layout definition item assigned to the item -- not the renderings on the page
    - [x] `presentation-list-renderings`: lists the renderings placed on the item as structured rows -- the page's composition
    - [x] `presentation-set-layout`: sets item presentation layout
    - [x] `presentation-reset-layout`: resets item presentation layout
    - [x] `presentation-merge-layout`: Merges final and shared layouts
    - [x] `presentation-get-layout-device`: Gets the layout for the device specified
    - [x] `presentation-get-default-layout-device`: Gets the default layout
    - [x] `presentation-get-rendering`: Gets rendering definition
    - [x] `presentation-remove-rendering`: Removes renderings from an item
    - [x] `presentation-add-rendering`: Adds a rendering to presentation of an item
    - [x] `presentation-set-rendering`: Updates rendering with new values
    - [x] `presentation-switch-rendering`: Switches an existing rendering on an item for an alternate one; the rendering to replace is named by `oldRenderingId`, `oldRenderingPath` or `uniqueId`
    - [x] `presentation-get-placeholder-setting`: Gets placeholder setting assigned on the item
    - [x] `presentation-add-placeholder-setting`: Adds a placeholder setting to the item
    - [x] `presentation-remove-placeholder-setting`: Removes placeholder setting from the item
    - [x] `presentation-get-rendering-parameter`: Gets rendering parameter for the item
    - [x] `presentation-remove-rendering-parameter`: Removes the specified rendering parameter from the rendering placed on the item
    - [x] `presentation-set-rendering-parameter`: Adds and updates the specified rendering parameter from the rendering placed on the item
  - [x] Indexing
    - [x] `indexing-initialize-search-index`: initializes one or more search indexes
    - [x] `indexing-get-search-index`: returns a search index
    - [x] `indexing-find-item`: finds an item in a search index    
    - [x] `indexing-suspend-search-index`: suspends one or more running search indexes
    - [x] `indexing-stop-search-index`: stops one or more running search indexes
    - [x] `indexing-resume-search-index`: resumes one or more paused search indexes
    - [x] `indexing-initialize-search-index-item`: rebuilds the index for a given tree with the specified root item and index name
    - [x] `indexing-remove-search-index-item`: removes an item from the search index
    - [ ] ~~`indexing-initialize-item`: initializes items with the PowerShell automatic properties for each field.~~ Skipped, no value for MCP server.
  - [x] Site composition
    - [x] `get-allowed-components-by-placeholder`: lists the renderings a placeholder allows on a page, from the site-level and global placeholder settings items
    - [x] `create-component-datasource`: creates a component's datasource item from the Datasource Template and Datasource Location declared on the rendering, page-local or shared
    - [x] `add-rendering-to-placeholder`: adds a rendering to a placeholder, refusing one the placeholder settings forbid, assigning a collision-free `DynamicPlaceholderId` and writing the full parameter set
    - [x] `list-sites`: lists the content sites registered on the CM with their root and start paths
    - [x] `get-site-information`: one site's definition plus the paths the composition tools need (home, placeholder settings, available renderings, shared data, site definition item)
    - [x] `get-pages-by-site`: the pages of a site as `{ID, Path, Template, TemplateID}`
    - [x] `search-site-pages`: the same set filtered by name or title
    - [x] `list-site-components`: the site's Available Renderings groups -- the component inventory, *not* an allow-list
    - [x] `list-insert-options`: the templates and branches that may be created under an item
  - [x] Common
    - [x] `common-add-base-template`: adds a base template to a template item
    - [x] `common-add-item-version`: creates a version of the item in a new language based on an existing language version
    - [x] `common-convert-from-item-clone`: converts an item from a clone to a fully independent item
    - [x] `common-get-archive`: gets Sitecore database archives
    - [x] `common-get-archive-item`: gets a list of items found in the specified archive
    - [x] `common-get-cache`: gets information about Sitecore caches
    - [x] `common-get-database`: gets information about Sitecore databases
    - [x] `common-get-item-field`: gets item fields as either names or fields or template fields
    - [x] `common-get-item-clone`: gets all the clones for the specified item
    - [x] `common-get-item-reference`: gets item references (where it is used) for a Sitecore item
    - [x] `common-get-item-referrer`: gets items referring to a Sitecore item (which items reference it)
    - [x] `common-get-item-template`: gets template information for a Sitecore item
    - [x] `common-get-item-workflow-event`: gets entries from the workflow history for the specified item
    - [x] `common-get-sitecore-job`: gets list of the current Sitecore jobs
    - [x] `common-invoke-workflow`: executes workflow action for a Sitecore item
    - [x] `common-new-item-clone`: creates a new item clone based on the item provided
    - [x] `common-new-item-workflow-event`: creates a new entry in the workflow history for a Sitecore item
    - [x] `common-publish-item`: publishes a Sitecore item
    - [x] `common-remove-archive-item`: removes items permanently from the specified archive
    - [x] `common-remove-base-template`: removes a base template from a template item
    - [x] `common-remove-item-version`: removes a version of a Sitecore item
    - [x] `common-reset-item-field`: resets item fields, specified as either names, fields or template fields
    - [x] `common-restart-application`: restarts the Sitecore Application pool
    - [x] `common-restore-archive-item`: restores items to the original database from the specified archive
    - [x] `common-set-item-template`: sets the item template
    - [x] `common-test-base-template`: checks if the item inherits from the specified template
    - [x] `common-update-item-referrer`: updates all references to the specified item to point to a new provided in the -NewTarget or removes links to the item
  - [x] Logging
    - [x] `logging-get-logs`: retrieves Sitecore logs from the log directory with filtering options

- [ ] Sitecore CLI
  - [x] `sitecore-cli-documentation`: gets sitecore cli documentation to provide more context for LLM 

### Tools selection

AI Agents may have limit on the amount of tools they can use. Please make sure that you have disabled the tools you don't need. It will make your agent faster, cheaper and more efficient.

Schema cost is paid on every turn whether a tool is called or not, so three optional
environment variables control which tools get registered. All three are unset by default,
which registers everything, and the denylist always wins on conflict.

#### `TOOL_GROUPS`

Comma-separated allowlist of tool groups. The groups are the directory layout, not a new
taxonomy:

`graphql`, `item-service`, `powershell.core`, `powershell.composition`,
`powershell.security`, `powershell.common`, `powershell.presentation`,
`powershell.logging`, `powershell.provider`, `powershell.indexing`, `sitecore-cli`

`powershell.core` is `get-powershell-documentation` and `run-powershell-script`. Unset
means every group. Skipping a group also skips its registrars' startup work, not just
their schemas.

`powershell.composition` is the site-aware composition set, kept separate from
`powershell.presentation` because the two answer different questions.
`powershell.presentation` is the thin SPE wrapper set: it writes the layout it is told to,
including an invalid one. `powershell.composition` is the layer that reads placeholder
settings, datasource locations and available renderings in order to *refuse* an invalid
layout, and it is the one to reach for when authoring pages. A client that only inspects a
page's structure wants the first.

#### `DISABLED_TOOLS`

Comma-separated list of exact tool names to leave unregistered, e.g.
`DISABLED_TOOLS=indexing-find-item,run-powershell-script`.

#### `TOOL_PROFILE`

A documented preset denylist for a platform. `DISABLED_TOOLS` entries are unioned on top
of it. This server targets XM Cloud **and** XM/XP, so **no tool is disabled by default**:
what is dead weight on one platform is core workflow on the other.

The profile table lives in [`src/tool-profiles.ts`](src/tool-profiles.ts).

| Profile | Hides | Why |
| --- | --- | --- |
| `xp` (or unset) | nothing | Publishing, application restart and CM-side identity management are all real operations on XM/XP. |
| `xmcloud` | `common-publish-item` | An XM Cloud CM has no `web` database and no local Edge publishing target; publishing is a deployment-environment operation. |
| `xmcloud` | `common-restart-application` | The CM is a managed container; recycling the application pool is not the caller's to do. |
| `xmcloud` | the whole `powershell.security` group | Users, roles and domains are managed in the Sitecore Cloud Portal, not on the CM, so the CM-side identity tools are misleading at best. Note that this also hides the item ACL, lock and protect tools, which *do* work on an XM Cloud CM — if you need those, use `TOOL_PROFILE=xp` with `DISABLED_TOOLS` instead. |

## Installation

Add the following Model Context Protocol server to your Cursor, VS Code, Claude:

```json
    "Sitecore": {
        "type": "stdio",
        "command": "npx",
        "args": ["@antonytm/mcp-sitecore-server@latest"],
        "env": {
          "TRANSPORT": "stdio",
          "GRAPHQL_ENDPOINT": "https://xmcloudcm.localhost/sitecore/api/graph/",
          "GRAPHQL_SCHEMAS": "edge,master,core",
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
        }
    }
```

### Environment Variables Description

- `TRANSPORT`: The transport protocol to use. Options are `stdio` (the default) and
  `streamable-http`, which listens on port 3001 and serves MCP at `/mcp`. `sse` is gone:
  the SSE transport was removed from the MCP specification and the SDK. Setting it still
  starts an HTTP server on port 3001 -- Streamable HTTP at `/mcp` -- and says so on
  stderr, so a client configured for `/sse` has to be repointed at `/mcp`.
- `GRAPHQL_ENDPOINT`: The GraphQL endpoint URL for the Sitecore instance.
- `GRAPHQL_SCHEMAS`: The Sitecore schemas to use for the GraphQL API, comma-separated.
- `GRAPHQL_API_KEY`: The API key for the GraphQL endpoint.
- `GRAPHQL_HEADERS`: Additional headers to include in the GraphQL requests.
- `ITEM_SERVICE_DOMAIN`: The domain for the Item Service API authentication. Default is `sitecore`.
- `ITEM_SERVICE_USERNAME`: The username for the Item Service API authentication.
- `ITEM_SERVICE_PASSWORD`: The password for the Item Service API authentication.
- `ITEM_SERVICE_SERVER_URL`: The base URL for the Item Service API.
- `POWERSHELL_DOMAIN`: The domain for the Sitecore PowerShell Remoting API authentication. Default is `sitecore`.
- `POWERSHELL_USERNAME`: The username for the Sitecore PowerShell Remoting API authentication.
- `POWERSHELL_PASSWORD`: The password for the Sitecore PowerShell Remoting API authentication.
- `POWERSHELL_SERVER_URL`: The base URL for the Sitecore PowerShell Remoting API.
- `TOOL_GROUPS`: Optional. Comma-separated allowlist of tool groups to register. Unset registers every group. See [Tools selection](#tools-selection).
- `DISABLED_TOOLS`: Optional. Comma-separated list of exact tool names to leave unregistered.
- `TOOL_PROFILE`: Optional. A documented preset denylist for a platform: `xp` (or unset) disables nothing, `xmcloud` hides the publish/restart/CM-identity set. See [Tools selection](#tools-selection).
- `POWERSHELL_TIMEOUT_MS`: Optional. Timeout in milliseconds for a single PowerShell Remoting request. Default is `600000` (10 minutes).
- `POWERSHELL_FULL_ERRORS`: Optional. Set to `true` to return the complete .NET error record instead of the shaped summary when a PowerShell command fails. Individual tools also accept `full: true` per call.
- `AUTHORIZATION_HEADER`: Optional. If set, it will be used as an authorization header for access to the server. MCP server will expect `authorization` header to be passed with the value of this environment variable. If environment variable is not set, the server will not check for the authorization header.

## Docker images

- `antonytm/mcp-sitecore-linux`: [The Linux version](https://hub.docker.com/r/antonytm/mcp-sitecore-linux) of the MCP Sitecore server.
- `antonytm/mcp-sitecore-windows`: [The Windows version](https://hub.docker.com/r/antonytm/mcp-sitecore-windows) of the MCP Sitecore server.

## Resources list

- [x] `config`: returns the configuration of the server. Use it to check if everything is properly configured.

## Local Installation / Development

1. Clone the repository
2. Run `npm install` to install dependencies
3. Run `npm run build` to build the project
4. Run `npm start` to start the server over Streamable HTTP on port 3001 (`/mcp`), or
   `npm run start:stdio` to start it over stdio

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details.
