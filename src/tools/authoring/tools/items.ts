import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { requireOneTarget } from "@/tools/target-input.js";
import { runAuthoringOperation } from "../logic/run.js";
import { ITEM_SELECTION, MUTATED_ITEM_SELECTION } from "../logic/selections.js";

/**
 * Item operations over the Authoring and Management API.
 *
 * These overlap the Item Service (`item-service-*`) and SPE (`provider-get-item`,
 * `common-*`) tools, and the overlap is the point: this is the one surface Sitecore
 * supports for authoring writes, it needs no SPE Remoting and no Item Service, and on
 * SitecoreAI it is the surface that stays available when those are switched off. Where an
 * agent has a choice, this is the one to reach for.
 *
 * Every input type and field name below is taken from a live endpoint's SDL, not from the
 * documentation's examples.
 */

/** The two field-scope switches shared by every tool that reads item fields. */
const fieldScope = {
    ownFields: z.boolean().optional().default(true)
        .describe("When true (the default), return only fields defined on the item's own template rather than every inherited field."),
    excludeStandardFields: z.boolean().optional().default(true)
        .describe("When true (the default), omit Sitecore's standard fields (__Created, __Workflow and the rest). Set false when you need one of them."),
};

export function authoringGetItemTool(server: McpServer, config: Config) {
    server.registerTool(
        "authoring-get-item",
        {
            description:
                "Reads a Sitecore item by ID or path over the Authoring and Management API, "
                + "returning its identity, template and field values. Reads the authoring database, "
                + "so unpublished content is visible — unlike the Edge query tools. Supply exactly "
                + "one of id or path.",
            inputSchema: z.object({
                id: z.string().optional()
                    .describe("The item's GUID, e.g. '{110D559F-DEA5-42EA-9C1C-8A5DF7E70EF9}'. Supply this or path."),
                path: z.string().optional()
                    .describe("The item's full path, e.g. '/sitecore/content/Home'. Supply this or id."),
                database: z.string().optional()
                    .describe("The database to read. Defaults to the endpoint's own default (master)."),
                language: z.string().optional().describe("The item language, e.g. 'en'."),
                version: z.number().int().optional().describe("The item version. Defaults to the latest."),
                ...fieldScope,
            }),
        },
        (params) => {
            const invalid = requireOneTarget(params, ["id", "path"]);
            if (invalid) {
                return Promise.resolve(invalid);
            }

            const query = `
                query GetItem(
                  $where: ItemQueryInput
                  $ownFields: Boolean!
                  $excludeStandardFields: Boolean!
                ) {
                  item(where: $where) {${ITEM_SELECTION}
                  }
                }`;

            return safeMcpResponse(runAuthoringOperation(config, query, {
                where: {
                    itemId: params.id,
                    path: params.path,
                    database: params.database,
                    language: params.language,
                    version: params.version,
                },
                ownFields: params.ownFields,
                excludeStandardFields: params.excludeStandardFields,
            }));
        }
    );
}

export function authoringCreateItemTool(server: McpServer, config: Config) {
    server.registerTool(
        "authoring-create-item",
        {
            description:
                "Creates a Sitecore item from a template over the Authoring and Management API and "
                + "returns the created item. The parent must be given as a GUID (the API takes no "
                + "parent path here) — use authoring-get-item to resolve a path to its ID first.",
            inputSchema: z.object({
                name: z.string().describe("The new item's name. Sitecore rejects names containing / \\ : ? \" < > | [ ]."),
                templateId: z.string()
                    .describe("The GUID of the template to create from, e.g. '{76036F5E-CBCE-46D1-AF0A-4143F9B557AA}'."),
                parent: z.string()
                    .describe("The GUID of the parent item. A path is not accepted — resolve it with authoring-get-item."),
                language: z.string().optional().describe("The language to create the first version in, e.g. 'en'."),
                database: z.string().optional().describe("The database to create in. Defaults to master."),
                fields: z.array(z.object({
                    name: z.string().describe("The field name, e.g. 'Title'."),
                    value: z.string().describe("The field value."),
                })).optional().describe("Field values to set on the new item."),
            }),
        },
        (params) => {
            const query = `
                mutation CreateItem($input: CreateItemInput!) {
                  createItem(input: $input) {
                    item {${MUTATED_ITEM_SELECTION}
                      fields(ownFields: true, excludeStandardFields: true) {
                        nodes { name value }
                      }
                    }
                  }
                }`;

            return safeMcpResponse(runAuthoringOperation(config, query, {
                input: {
                    name: params.name,
                    templateId: params.templateId,
                    parent: params.parent,
                    language: params.language,
                    database: params.database,
                    fields: params.fields,
                },
            }));
        }
    );
}

export function authoringUpdateItemTool(server: McpServer, config: Config) {
    server.registerTool(
        "authoring-update-item",
        {
            description:
                "Sets field values on an existing Sitecore item over the Authoring and Management "
                + "API. Only the fields named are touched; set reset true on a field to return it to "
                + "its template's standard value instead of writing a value. Supply exactly one of id "
                + "or path.",
            inputSchema: z.object({
                id: z.string().optional().describe("The item's GUID. Supply this or path."),
                path: z.string().optional().describe("The item's full path. Supply this or id."),
                fields: z.array(z.object({
                    name: z.string().describe("The field name, e.g. 'Title'."),
                    value: z.string().optional().describe("The value to write. Omit when reset is true."),
                    reset: z.boolean().optional()
                        .describe("When true, clear the item's own value so the template's standard value applies again."),
                })).min(1).describe("The fields to change. At least one."),
                language: z.string().optional().describe("The language version to write, e.g. 'en'."),
                version: z.number().int().optional().describe("The item version to write. Defaults to the latest."),
                database: z.string().optional().describe("The database holding the item. Defaults to master."),
            }),
        },
        (params) => {
            const invalid = requireOneTarget(params, ["id", "path"]);
            if (invalid) {
                return Promise.resolve(invalid);
            }

            const query = `
                mutation UpdateItem($input: UpdateItemInput!) {
                  updateItem(input: $input) {
                    item {${MUTATED_ITEM_SELECTION}
                      fields(ownFields: true, excludeStandardFields: true) {
                        nodes { name value }
                      }
                    }
                  }
                }`;

            return safeMcpResponse(runAuthoringOperation(config, query, {
                input: {
                    itemId: params.id,
                    path: params.path,
                    fields: params.fields,
                    language: params.language,
                    version: params.version,
                    database: params.database,
                },
            }));
        }
    );
}

export function authoringDeleteItemTool(server: McpServer, config: Config) {
    server.registerTool(
        "authoring-delete-item",
        {
            description:
                "Deletes a Sitecore item over the Authoring and Management API. By default the item "
                + "goes to the recycle bin and can be restored; permanently true destroys it outright. "
                + "Deleting an item deletes its descendants with it. Supply exactly one of id or path.",
            inputSchema: z.object({
                id: z.string().optional().describe("The item's GUID. Supply this or path."),
                path: z.string().optional().describe("The item's full path. Supply this or id."),
                permanently: z.boolean().optional()
                    .describe("When true, delete outright instead of moving to the recycle bin. Not reversible."),
                database: z.string().optional().describe("The database holding the item. Defaults to master."),
            }),
        },
        (params) => {
            const invalid = requireOneTarget(params, ["id", "path"]);
            if (invalid) {
                return Promise.resolve(invalid);
            }

            const query = `
                mutation DeleteItem($input: DeleteItemInput!) {
                  deleteItem(input: $input) { successful }
                }`;

            return safeMcpResponse(runAuthoringOperation(config, query, {
                input: {
                    itemId: params.id,
                    path: params.path,
                    permanently: params.permanently,
                    database: params.database,
                },
            }));
        }
    );
}

export function authoringCopyItemTool(server: McpServer, config: Config) {
    server.registerTool(
        "authoring-copy-item",
        {
            description:
                "Copies a Sitecore item to another parent over the Authoring and Management API. "
                + "Copies the whole subtree by default; set deepCopy false to copy the item alone. "
                + "Supply exactly one of id or path for the source, and exactly one of "
                + "targetParentId or targetParentPath for the destination.",
            inputSchema: z.object({
                id: z.string().optional().describe("The source item's GUID. Supply this or path."),
                path: z.string().optional().describe("The source item's full path. Supply this or id."),
                targetParentId: z.string().optional()
                    .describe("The GUID of the parent to copy into. Supply this or targetParentPath."),
                targetParentPath: z.string().optional()
                    .describe("The path of the parent to copy into. Supply this or targetParentId."),
                copyItemName: z.string().optional()
                    .describe("The name for the copy. Defaults to Sitecore's own 'Copy of ...' naming."),
                deepCopy: z.boolean().optional()
                    .describe("When false, copy only the item itself. Defaults to true (the whole subtree)."),
                database: z.string().optional().describe("The database holding the item. Defaults to master."),
            }),
        },
        (params) => {
            const invalidSource = requireOneTarget(params, ["id", "path"]);
            if (invalidSource) {
                return Promise.resolve(invalidSource);
            }
            const invalidTarget = requireOneTarget(params, ["targetParentId", "targetParentPath"]);
            if (invalidTarget) {
                return Promise.resolve(invalidTarget);
            }

            const query = `
                mutation CopyItem($input: CopyItemInput!) {
                  copyItem(input: $input) {
                    item {${MUTATED_ITEM_SELECTION}
                      parent { itemId path }
                    }
                  }
                }`;

            return safeMcpResponse(runAuthoringOperation(config, query, {
                input: {
                    itemId: params.id,
                    path: params.path,
                    targetParentId: params.targetParentId,
                    targetParentPath: params.targetParentPath,
                    copyItemName: params.copyItemName,
                    deepCopy: params.deepCopy,
                    database: params.database,
                },
            }));
        }
    );
}

export function authoringMoveItemTool(server: McpServer, config: Config) {
    server.registerTool(
        "authoring-move-item",
        {
            description:
                "Moves a Sitecore item to another parent over the Authoring and Management API, "
                + "taking its descendants with it. Every link to the item survives the move — "
                + "prefer this over delete-and-recreate, which breaks them. Supply exactly one of "
                + "id or path, and exactly one of targetParentId or targetParentPath.",
            inputSchema: z.object({
                id: z.string().optional().describe("The item's GUID. Supply this or path."),
                path: z.string().optional().describe("The item's full path. Supply this or id."),
                targetParentId: z.string().optional()
                    .describe("The GUID of the parent to move into. Supply this or targetParentPath."),
                targetParentPath: z.string().optional()
                    .describe("The path of the parent to move into. Supply this or targetParentId."),
                sortOrder: z.number().int().optional()
                    .describe("The sort order to give the item under its new parent."),
                database: z.string().optional().describe("The database holding the item. Defaults to master."),
            }),
        },
        (params) => {
            const invalidSource = requireOneTarget(params, ["id", "path"]);
            if (invalidSource) {
                return Promise.resolve(invalidSource);
            }
            const invalidTarget = requireOneTarget(params, ["targetParentId", "targetParentPath"]);
            if (invalidTarget) {
                return Promise.resolve(invalidTarget);
            }

            const query = `
                mutation MoveItem($input: MoveItemInput!) {
                  moveItem(input: $input) {
                    item {${MUTATED_ITEM_SELECTION}
                      parent { itemId path }
                    }
                  }
                }`;

            return safeMcpResponse(runAuthoringOperation(config, query, {
                input: {
                    itemId: params.id,
                    path: params.path,
                    targetParentId: params.targetParentId,
                    targetParentPath: params.targetParentPath,
                    sortOrder: params.sortOrder,
                    database: params.database,
                },
            }));
        }
    );
}

export function authoringRenameItemTool(server: McpServer, config: Config) {
    server.registerTool(
        "authoring-rename-item",
        {
            description:
                "Renames a Sitecore item over the Authoring and Management API. The item keeps its "
                + "ID, so links to it survive, but its path changes and any URL derived from the name "
                + "changes with it. Supply exactly one of id or path.",
            inputSchema: z.object({
                id: z.string().optional().describe("The item's GUID. Supply this or path."),
                path: z.string().optional().describe("The item's full path. Supply this or id."),
                newName: z.string().describe("The new name. Sitecore rejects names containing / \\ : ? \" < > | [ ]."),
                database: z.string().optional().describe("The database holding the item. Defaults to master."),
            }),
        },
        (params) => {
            const invalid = requireOneTarget(params, ["id", "path"]);
            if (invalid) {
                return Promise.resolve(invalid);
            }

            const query = `
                mutation RenameItem($input: RenameItemInput!) {
                  renameItem(input: $input) {
                    item {${MUTATED_ITEM_SELECTION}
                    }
                  }
                }`;

            return safeMcpResponse(runAuthoringOperation(config, query, {
                input: {
                    itemId: params.id,
                    path: params.path,
                    newName: params.newName,
                    database: params.database,
                },
            }));
        }
    );
}
