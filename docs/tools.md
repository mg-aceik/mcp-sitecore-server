# Tool reference

115 tools across search, query, create, read, update, delete, PowerShell, logging,
security and presentation, covering the Item Service, GraphQL Edge and Sitecore
PowerShell Extensions.

See [Tool selection](./tool-selection.md) for trimming this surface down to what your
agent actually needs.

## Addressing an item

Most tools that act on an item take **`id` or `path`**, and exactly one of them must be
supplied — supplying both, or neither, is an input error that names the valid inputs and
never reaches Sitecore. Some take a wider union: `provider-get-item` also accepts `query`
and `uri`, and `presentation-switch-rendering` names the rendering to replace with
`oldRenderingId`, `oldRenderingPath` or `uniqueId`. A tool that addresses two things at
once (an item _and_ a rendering, placeholder setting or layout) validates each
independently. `database` is only sent when addressing by id: a path carries its own
prefix, as in `master:/sitecore/content/Home`.

Before 2.0.0 these were separate `-by-id` / `-by-path` tools. See
[`CHANGELOG.md`](../CHANGELOG.md) for the old-to-new name mapping.

## Tools

- [x] GraphQL API
  - [x] `introspection-graphql-{schema}`: returns the GraphQL schema
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
    - [x] `item-service-get-languages`: returns Sitecore languages in the instance
    - [x] `item-service-get-item-descendants`: returns the descendants of an item by ID
- [x] Sitecore PowerShell
  - [x] `get-powershell-documentation`: returns the documentation describing all Sitecore Powershell commands
  - [x] `run-powershell-script`: runs a PowerShell script and returns the output
  - [x] Security
    - [x] `security-get-current-user`: returns the current user
    - [x] `security-get-user-by-identity`: returns a user by name
    - [x] `security-get-user-by-filter`: returns a user by filter
    - [x] `security-new-domain`: creates a new domain
    - [x] `security-new-user`: creates a new user
    - [x] `security-new-role`: creates a new role
    - [x] `security-remove-domain`: removes a domain
    - [x] `security-remove-user`: removes a user
    - [x] `security-remove-role`: removes a role
    - [x] `security-get-domain`: returns all domains
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
    - [x] `security-unlock-user`: unlocks a user (verified live: a user locked out by repeated failed logins is unlocked by the tool)
    - ~~`security-login-user`: logs in a user~~ won't be implemented: SPE hollowed `Login-User` in 8.0 and marked it obsolete for removal — session login is an Identity-provider concern, not a CM cmdlet ([1367](https://github.com/SitecorePowerShell/Console/issues/1367))
    - ~~`security-logout-user`: logs out a user~~ won't be implemented: SPE hollowed `Logout-User` in 8.0 and marked it obsolete for removal ([1368](https://github.com/SitecorePowerShell/Console/issues/1368))
    - [x] `security-export-user`: exports a user to the server filesystem. Fixed in SPE 8.0 ([1370](https://github.com/SitecorePowerShell/Console/issues/1370))
    - [x] `security-import-user`: imports a user from the server filesystem ([1371](https://github.com/SitecorePowerShell/Console/issues/1371); works once the `.user` file exists — export first)
    - [x] `security-export-role`: exports a role to the server filesystem. Fixed in SPE 8.0 ([1369](https://github.com/SitecorePowerShell/Console/issues/1369))
    - [x] `security-import-role`: imports a role from the server filesystem ([1372](https://github.com/SitecorePowerShell/Console/issues/1372); works once the `.role` file exists — export first)
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
    - ~~`indexing-initialize-item`: initializes items with the PowerShell automatic properties for each field.~~ Skipped, no value for MCP server.
  - [x] Media
    - [x] `media-upload`: uploads a file into the media library via the SPE `mediaUpload` service — from a URL (fetched by the server, nothing passes through the model), a server-local file, or base64 — and returns the created item with its ID; sets alt text in the same call
    - [x] `media-download`: downloads a media item's blob via the SPE `mediaDownload` service, to a server-local file (`saveTo`) or inline as size-capped base64
  - [x] Site composition
    - [x] `get-allowed-components-by-placeholder`: lists the renderings a placeholder allows on a page, from the site-level and global placeholder settings items
    - [x] `create-component-datasource`: creates a component's datasource item from the Datasource Template and Datasource Location declared on the rendering, page-local or shared
    - [x] `add-rendering-to-placeholder`: adds a rendering to a placeholder, refusing one the placeholder settings forbid, assigning a collision-free `DynamicPlaceholderId` and writing the full parameter set
    - [x] `list-sites`: lists the content sites registered on the CM with their root and start paths
    - [x] `get-site-information`: one site's definition plus the paths the composition tools need (home, placeholder settings, available renderings, shared data, site definition item)
    - [x] `get-pages-by-site`: the pages of a site as `{ID, Path, Template, TemplateID}`
    - [x] `search-site-pages`: the same set filtered by name or title
    - [x] `list-site-components`: the site's Available Renderings groups -- the component inventory, _not_ an allow-list
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

- [x] Sitecore CLI
  - [x] `sitecore-cli-documentation`: gets sitecore cli documentation to provide more context for LLM

## Resources

- `config`: returns the configuration of the server. Use it to check if everything is
  properly configured.
