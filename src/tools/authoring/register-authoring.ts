import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { authoringIntrospectionTool, authoringQueryTool } from "./tools/core.js";
import {
    authoringCopyItemTool,
    authoringCreateItemTool,
    authoringDeleteItemTool,
    authoringGetItemTool,
    authoringMoveItemTool,
    authoringRenameItemTool,
    authoringUpdateItemTool,
} from "./tools/items.js";
import { authoringSearchTool } from "./tools/search.js";
import {
    authoringCreateTemplateTool,
    authoringGetTemplateTool,
    authoringUpdateTemplateTool,
} from "./tools/templates.js";
import { authoringGetMediaItemTool, authoringUploadMediaTool } from "./tools/media.js";
import { authoringGetSiteTool, authoringListSitesTool } from "./tools/sites.js";
import {
    authoringGetJobTool,
    authoringListJobsTool,
    authoringPublishItemTool,
    authoringPublishingStatusTool,
    authoringRebuildIndexesTool,
} from "./tools/management.js";

/**
 * The registrar sets for the Authoring and Management API, split the way Sitecore's own
 * documentation splits the schema: authoring operations (content) and management
 * operations (publishing, jobs, indexing), with the raw endpoint tools as their own group.
 *
 * `register.ts` holds the mapping from group name to these lists, so `TOOL_GROUPS` can
 * take the content tools without the management ones, or the raw endpoint alone.
 */

export const AUTHORING_CORE_REGISTRARS = [
    authoringIntrospectionTool,
    authoringQueryTool,
];

export const AUTHORING_CONTENT_REGISTRARS = [
    // Items
    authoringGetItemTool,
    authoringCreateItemTool,
    authoringUpdateItemTool,
    authoringDeleteItemTool,
    authoringCopyItemTool,
    authoringMoveItemTool,
    authoringRenameItemTool,

    // Search
    authoringSearchTool,

    // Templates
    authoringGetTemplateTool,
    authoringCreateTemplateTool,
    authoringUpdateTemplateTool,

    // Media
    authoringUploadMediaTool,
    authoringGetMediaItemTool,

    // Sites
    authoringListSitesTool,
    authoringGetSiteTool,
];

export const AUTHORING_MANAGEMENT_REGISTRARS = [
    authoringPublishItemTool,
    authoringPublishingStatusTool,
    authoringRebuildIndexesTool,
    authoringGetJobTool,
    authoringListJobsTool,
];

/** Registers every Authoring and Management tool, ignoring group gating. */
export function registerAuthoring(server: McpServer, config: Config) {
    for (const register of [
        ...AUTHORING_CORE_REGISTRARS,
        ...AUTHORING_CONTENT_REGISTRARS,
        ...AUTHORING_MANAGEMENT_REGISTRARS,
    ]) {
        register(server, config);
    }
}
