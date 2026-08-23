# Folder containing the wrapper for the Sitecore PowerShell Extensions API

This folder contains implementations of MCP tools that interact with Sitecore PowerShell Extensions.

## Folders structure

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

- `security-get-user-by-identity`: Get a user by identity
- `security-get-current-user`: Get the current user
- `security-get-user-by-filter`: Get users by filter
- `security-new-user`: Create a new user
- `security-remove-user`: Remove a user
- `security-disable-user`: Disable a user
- `security-enable-user`: Enable a user
- `security-unlock-user`: Unlock a user
- `security-set-user`: Update user properties

### Role Management

- `security-get-role-by-identity`: Get a role by identity
- `security-get-role-by-filter`: Get roles by filter
- `security-new-role`: Create a new role
- `security-remove-role`: Remove a role
- `security-get-role-member`: Get role members
- `security-add-role-member`: Add a member to a role
- `security-remove-role-member`: Remove a member from a role

### Domain Management

- `security-get-domain`: Get all domains
- `security-get-domain-by-name`: Get a domain by name
- `security-new-domain`: Create a new domain
- `security-remove-domain`: Remove a domain

### Item Security

- `security-get-item-acl`: Get ACL for an item
- `security-add-item-acl`: Add ACL entry to an item
- `security-test-item-acl`: Test ACL for an item
- `security-lock-item`: Lock an item
- `security-unlock-item`: Unlock an item
- `security-protect-item`: Protect an item
- `security-unprotect-item`: Unprotect an item

## Logging Tools

### Composite Logging Tools

- `logging-get-logs`: Retrieves Sitecore logs from the log directory with options for filtering by log name, level, date, and number of lines

## Indexing Tools

### Simple Indexing Tools

- `indexing-initialize-search-index`: Initialize one or more Sitecore search indexes
- `indexing-get-search-index`: Get information about Sitecore search indexes
- `indexing-find-item`: Find items using the Sitecore Content Search API
- `indexing-suspend-search-index`: Suspend one or more running Sitecore search indexes
- `indexing-stop-search-index`: Stop one or more running Sitecore search indexes
- `indexing-resume-search-index`: Resume one or more paused Sitecore search indexes

### Composite Indexing Tools

- `indexing-initialize-search-index-item`: Rebuild the index for a given tree with the specified root item
- `indexing-remove-search-index-item`: Remove the item with the specified ID from the search index

## Common Tools

### Simple Common Tools

- `common-add-base-template`: Add a base template to a template item
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
- `common-remove-base-template`: Remove a base template from a template item
- `common-remove-item-version`: Remove a version of a Sitecore item
- `common-reset-item-field`: Reset item fields, specified as either names, fields or template fields
- `common-restart-application`: Restart the Sitecore Application pool
- `common-set-item-template`: Set the item template
- `common-test-base-template`: Check if the item inherits from the specified template

### Composite Common Tools

- `common-get-archive`: Get Sitecore database archives
- `common-get-archive-item`: Get a list of items found in the specified archive
- `common-new-item-clone`: Create a new item clone based on the item provided
- `common-remove-archive-item`: Remove items permanently from the specified archive
- `common-restore-archive-item`: Restore items to the original database from the specified archive
- `common-update-item-referrer`: Update all references to the specified item to point to a new provided in the -NewTarget or removes links to the item