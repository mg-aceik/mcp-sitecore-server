# Folder containing the wrapper for the Sitecore PowerShell Extensions API

This folder contains implementations of MCP tools that interact with Sitecore PowerShell Extensions.

## Folders structure

The split between `simple` and `composite` is about how many SPE calls a tool makes, not
about how complicated its schema is:

- one cmdlet, always the same one → **simple**
- several calls, or a different cmdlet chosen from the parameters → **composite**

That is why the merged tools live under `composite` even though each one reads like a
single operation: `indexing-set-search-index-state` dispatches to `Suspend-`, `Stop-` or
`Resume-SearchIndex`, `common-set-base-template` to `Add-` or `Remove-BaseTemplate`, and so
on. The cmdlet is chosen at call time from what the caller passed.

- **simple**: contains simple implementations of Sitecore PowerShell commands
  - **security**: contains security-related PowerShell commands
    - User Management: create, get, modify, and remove users
    - Role Management: create, get, add/remove members, and remove roles
    - Domain Management: create, get, and remove domains
    - Item Security: get, test, add, protect/unprotect, and lock/unlock items
- **composite**: contains composite implementations that combine multiple PowerShell commands
- **user**: use this folder for combining your own MCP tools implementations


## Base Tools

- `get-powershell-documentation`: The SPE command reference, revealed progressively — an index first, then the full page for the commands you name. See `documentation-index.ts`.
- `run-powershell-script`: Run a PowerShell script and returns the output

## Security Tools

### User Management

- `security-get-user`: Get users by exact identity or wildcard filter
- `security-get-current-user`: Get the current user
- `security-new-user`: Create a new user
- `security-remove-user`: Remove a user
- `security-disable-user`: Disable a user
- `security-enable-user`: Enable a user
- `security-unlock-user`: Unlock a user
- `security-set-user`: Update user properties

### Role Management

- `security-get-role`: Get roles by exact identity or wildcard filter
- `security-new-role`: Create a new role
- `security-remove-role`: Remove a role
- `security-get-role-member`: Get role members
- `security-add-role-member`: Add a member to a role
- `security-remove-role-member`: Remove a member from a role

### Domain Management

- `security-get-domain`: Get all domains
- `security-get-domain`: Get domains; omit name for all
- `security-new-domain`: Create a new domain
- `security-remove-domain`: Remove a domain

### Item Security

Read with the simple tools; the three that pick their cmdlet from an `action` are composite.

- `security-get-item-acl`: Get ACL for an item
- `security-test-item-acl`: Test ACL for an item
- `security-set-item-acl` (composite): Add, replace or clear an item's access rules (`Add-ItemAcl`, `New-ItemAcl` into `Set-ItemAcl`, or `Clear-ItemAcl`). This is where the old `security-clear-item-acl` went — call it with `action: "clear"`.
- `security-set-item-lock` (composite): Lock or unlock an item (`Lock-Item` or `Unlock-Item`)
- `security-set-item-protection` (composite): Protect or unprotect an item (`Protect-Item` or `Unprotect-Item`)

### Account Serialization

- `security-export-account` (composite): Serialize a user or role to a file (`Export-User` or `Export-Role`)
- `security-import-account` (composite): Read a serialized user or role back in (`Import-User` or `Import-Role`)

## Logging Tools

### Composite Logging Tools

- `logging-get-logs`: Retrieves Sitecore logs from the log directory with options for filtering by log name, level, date, and number of lines

## Indexing Tools

### Simple Indexing Tools

- `indexing-get-search-index`: Get information about Sitecore search indexes
- `indexing-find-item`: Find items using the Sitecore Content Search API

### Composite Indexing Tools

- `indexing-rebuild-search-index`: Rebuild search indexes, optionally scoped to one item's subtree (`Initialize-SearchIndex` or `Initialize-SearchIndexItem`)
- `indexing-set-search-index-state`: Suspend, stop or resume Sitecore search indexes (`Suspend-`, `Stop-` or `Resume-SearchIndex`)


## Common Tools

### Simple Common Tools

- `common-add-item-version`: Create a version of the item in a new language based on an existing language version
- `common-convert-from-item-clone`: Convert an item from a clone to a fully independent item
- `common-get-cache`: Get information about Sitecore caches
- `common-get-database`: Get information about Sitecore databases
- `common-get-item-clone`: Get all the clones for the specified item
- `common-get-item-field`: Get item fields as either names or fields or template fields
- `common-get-item-reference`: Get item references (where it is used) for a Sitecore item
- `common-get-item-referrer`: Get items referring to a Sitecore item (which items reference it)
- `common-get-item-template`: Get template information for a Sitecore item
- `common-get-item-workflow-event`: Get entries from the workflow history for the specified item
- `common-get-sitecore-job`: Get list of the current Sitecore jobs
- `common-invoke-workflow`: Execute workflow action for a Sitecore item
- `common-new-item-workflow-event`: Create a new entry in the workflow history for a Sitecore item
- `common-publish-item`: Publish a Sitecore item
- `common-remove-item-version`: Remove a version of a Sitecore item
- `common-reset-item-field`: Reset item fields, specified as either names, fields or template fields
- `common-restart-application`: Restart the Sitecore Application pool
- `common-set-item-template`: Set the item template
- `common-test-base-template`: Check if the item inherits from the specified template

### Composite Common Tools

- `common-set-base-template`: Add or remove a base template on a template item (`Add-` or `Remove-BaseTemplate`)
- `common-get-archive`: Get Sitecore database archives
- `common-get-archive-item`: Get a list of items found in the specified archive
- `common-new-item-clone`: Create a new item clone based on the item provided
- `common-remove-archive-item`: Remove items permanently from the specified archive
- `common-restore-archive-item`: Restore items to the original database from the specified archive
- `common-update-item-referrer`: Update all references to the specified item to point to a new provided in the -NewTarget or removes links to the item