import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "./config.js";

import { registerGraphQL } from "./tools/graphql/register-graphql.js";
import { getItemTool } from "./tools/item-service/tools/simple/get-item.js";
import { getItemChildrenTool } from "./tools/item-service/tools/simple/get-item-children.js";
import { createItemTool } from "./tools/item-service/tools/simple/create-item.js";
import { editItemTool } from "./tools/item-service/tools/simple/edit-item.js";
import { deleteItemTool } from "./tools/item-service/tools/simple/delete-item.js";
import { searchItemsTool } from "./tools/item-service/tools/simple/search-items.js";
import { runStoredQueryTool } from "./tools/item-service/tools/simple/run-stored-query.js";
import { runStoredSearchTool } from "./tools/item-service/tools/simple/run-stored-search.js";
import { getItemDescendantsTool } from "./tools/item-service/tools/composite/get-item-descendants.js";
import { getLanguagesTool } from "./tools/item-service/tools/composite/get-languages.js";
import { getUserByIdentityPowerShellTool } from "./tools/powershell/simple/security/get-user-by-identity.js";
import { getCurrentUserPowerShellTool } from "./tools/powershell/simple/security/get-current-user.js";
import { getUserByFilterPowerShellTool } from "./tools/powershell/simple/security/get-user-by-filter.js";
import { newUserPowerShellTool } from "./tools/powershell/simple/security/new-user.js";
import { removeUserPowerShellTool } from "./tools/powershell/simple/security/remove-user.js";
import { disableUserPowerShellTool } from "./tools/powershell/simple/security/disable-user.js";
import { enableUserPowerShellTool } from "./tools/powershell/simple/security/enable-user.js";
import { unlockUserPowerShellTool } from "./tools/powershell/simple/security/unlock-user.js";
import { exportUserPowerShellTool } from "./tools/powershell/simple/security/export-user.js";
import { importUserPowerShellTool } from "./tools/powershell/simple/security/import-user.js";
import { exportRolePowerShellTool } from "./tools/powershell/simple/security/export-role.js";
import { importRolePowerShellTool } from "./tools/powershell/simple/security/import-role.js";
import { setUserPowerShellTool } from "./tools/powershell/simple/security/set-user.js";
import { setUserPasswordPowerShellTool } from "./tools/powershell/simple/security/set-user-password.js";
import { getRoleByIdentityPowerShellTool } from "./tools/powershell/simple/security/get-role-by-identity.js";
import { getRoleByFilterPowerShellTool } from "./tools/powershell/simple/security/get-role-by-filter.js";
import { getRoleMemberPowerShellTool } from "./tools/powershell/simple/security/get-role-member.js";
import { addRoleMemberPowerShellTool } from "./tools/powershell/simple/security/add-role-member.js";
import { removeRoleMemberPowerShellTool } from "./tools/powershell/simple/security/remove-role-member.js";
import { unlockItemPowerShellTool } from "./tools/powershell/simple/security/unlock-item.js";
import { protectItemPowerShellTool } from "./tools/powershell/simple/security/protect-item.js";
import { newRolePowerShellTool } from "./tools/powershell/simple/security/new-role.js";
import { removeRolePowerShellTool } from "./tools/powershell/simple/security/remove-role.js";
import { newDomainPowerShellTool } from "./tools/powershell/simple/security/new-domain.js";
import { removeDomainPowerShellTool } from "./tools/powershell/simple/security/remove-domain.js";
import { testAccountPowerShellTool } from "./tools/powershell/simple/security/test-account.js";
import { getItemAclPowerShellTool } from "./tools/powershell/simple/security/get-item-acl.js";
import { testItemAclPowerShellTool } from "./tools/powershell/simple/security/test-item-acl.js";
import { addItemAclPowerShellTool } from "./tools/powershell/simple/security/add-item-acl.js";
import { clearItemAclPowerShellTool } from "./tools/powershell/simple/security/clear-item-acl.js";
import { getItemPowerShellTool } from "./tools/powershell/simple/provider/get-item.js";
import { initializeSearchIndexPowerShellTool } from "./tools/powershell/simple/indexing/initialize-search-index.js";
import { getSearchIndexPowerShellTool } from "./tools/powershell/simple/indexing/get-search-index.js";
import { findItemPowerShellTool } from "./tools/powershell/simple/indexing/find-item.js";
import { resumeSearchIndexPowerShellTool } from "./tools/powershell/simple/indexing/resume-search-index.js";
import { suspendSearchIndexPowerShellTool } from "./tools/powershell/simple/indexing/suspend-search-index.js";
import { stopSearchIndexPowerShellTool } from "./tools/powershell/simple/indexing/stop-search-index.js";
import { setItemAclPowerShellTool } from "./tools/powershell/composite/security/set-item-acl.js";
import { initializeSearchIndexingItemPowerShellTool } from "./tools/powershell/composite/indexing/initialialize-search-indexing-item.js";
import { removeSearchIndexItemPowerShellTool } from "./tools/powershell/composite/indexing/remove-search-index-item.js";
import { lockItemPowerShellTool } from "./tools/powershell/simple/security/lock-item.js";
import { unprotectItemPowerShellTool } from "./tools/powershell/simple/security/unprotect-item.js";
import { getDomainByNamePowerShellTool } from "./tools/powershell/simple/security/get-domain-by-name.js";
import { getAllDomainsPowerShellTool } from "./tools/powershell/simple/security/get-all-domains.js";
import { getArchivePowerShellTool } from "./tools/powershell/composite/common/get-archive.js";
import { getArchiveItemPowerShellTool } from "./tools/powershell/composite/common/get-archive-item.js";
import { getDatabasePowerShellTool } from "./tools/powershell/simple/common/get-database.js";
import { getCachePowerShellTool } from "./tools/powershell/simple/common/get-cache.js";
import { getItemTemplatePowerShellTool } from "./tools/powershell/simple/common/get-item-template.js";
import { setItemTemplatePowerShellTool } from "./tools/powershell/simple/common/set-item-template.js";
import { addBaseTemplatePowerShellTool } from "./tools/powershell/simple/common/add-base-template.js";
import { removeBaseTemplatePowerShellTool } from "./tools/powershell/simple/common/remove-base-template.js";
import { getItemFieldPowerShellTool } from "./tools/powershell/simple/common/get-item-field.js";
import { getItemReferencePowerShellTool } from "./tools/powershell/simple/common/get-item-reference.js";
import { getItemReferrerPowerShellTool } from "./tools/powershell/simple/common/get-item-referrer.js";
import { getItemWorkflowEventPowerShellTool } from "./tools/powershell/simple/common/get-item-workflow-event.js";
import { getPowershellDocumentationTool } from "./tools/powershell/get-powershell-documentation.js";
import { runPowershellScriptTool } from "./tools/powershell/run-powershell-script.js";
import { getSitecoreJobPowerShellTool } from "./tools/powershell/simple/common/get-sitecore-job.js";
import { addItemVersionPowerShellTool } from "./tools/powershell/simple/common/add-item-version.js";
import { invokeWorkflowPowerShellTool } from "./tools/powershell/simple/common/invoke-workflow.js";
import { newItemWorkflowEventPowerShellTool } from "./tools/powershell/simple/common/new-item-workflow-event.js";
import { publishItemPowerShellTool } from "./tools/powershell/simple/common/publish-item.js";
import { removeArchiveItemPowerShellTool } from "./tools/powershell/composite/common/remove-archive-item.js";
import { removeItemVersionPowerShellTool } from "./tools/powershell/simple/common/remove-item-version.js";
import { resetItemFieldPowerShellTool } from "./tools/powershell/simple/common/reset-item-field.js";
import { restartApplicationPowerShellTool } from "./tools/powershell/simple/common/restart-application.js";
import { restoreArchiveItemPowerShellTool } from "./tools/powershell/composite/common/restore-archive-item.js";
import { testBaseTemplatePowerShellTool } from "./tools/powershell/simple/common/test-base-template.js";
import { updateItemReferrerPowerShellTool } from "./tools/powershell/composite/common/update-item-referrer.js";
import { getItemClonePowerShellTool } from "./tools/powershell/simple/common/get-item-clone.js";
import { convertFromItemClonePowerShellTool } from "./tools/powershell/simple/common/convert-from-item-clone.js";
import { newItemClonePowerShellTool } from "./tools/powershell/composite/common/new-item-clone.js";

import { getLayoutPowershellTool } from "./tools/powershell/simple/presentation/get-layout.js";
import { setLayoutPowershellTool } from "./tools/powershell/composite/presentation/set-layout.js";
import { resetLayoutPowershellTool } from "./tools/powershell/simple/presentation/reset-layout.js";
import { mergeLayoutPowershellTool } from "./tools/powershell/simple/presentation/merge-layout.js";
import { getLayoutDevicePowershellTool } from "./tools/powershell/simple/presentation/get-layout-device.js";
import { getDefaultLayoutDevicePowershellTool } from "./tools/powershell/simple/presentation/get-default-layout-device.js";
import { getRenderingPowershellTool } from "./tools/powershell/simple/presentation/get-rendering.js";
import { removeRenderingPowershellTool } from "./tools/powershell/simple/presentation/remove-rendering.js";
import { addRenderingPowershellTool } from "./tools/powershell/composite/presentation/add-rendering.js";
import { setRenderingPowershellTool } from "./tools/powershell/composite/presentation/set-rendering.js";
import { switchRenderingPowershellTool } from "./tools/powershell/composite/presentation/switch-rendering.js";
import { getPlaceholderSettingPowershellTool } from "./tools/powershell/simple/presentation/get-placeholder-setting.js";
import { addPlaceholderSettingPowershellTool } from "./tools/powershell/composite/presentation/add-placeholder-setting.js";
import { removePlaceholderSettingPowershellTool } from "./tools/powershell/simple/presentation/remove-placeholder-setting.js";
import { getRenderingParameterPowershellTool } from "./tools/powershell/composite/presentation/get-rendering-parameter.js";
import { removeRenderingParameterPowershellTool } from "./tools/powershell/composite/presentation/remove-rendering-parameter.js";
import { setRenderingParameterPowershellTool } from "./tools/powershell/composite/presentation/set-rendering-parameter.js";
import { getLogsPowerShellTool } from "./tools/powershell/composite/logging/get-logs.js";
import { getSitecoreCliDocumentation } from "./tools/sitecore-cli/get-sitecore-cli-documentation.js";
import { mediaUploadTool } from "./tools/powershell/media/media-upload.js";
import { mediaDownloadTool } from "./tools/powershell/media/media-download.js";
import { listRenderingsPowershellTool } from "./tools/powershell/composite/presentation/list-renderings.js";
import { getAllowedComponentsByPlaceholderPowershellTool } from "./tools/powershell/composite/composition/get-allowed-components-by-placeholder.js";
import { createComponentDatasourcePowershellTool } from "./tools/powershell/composite/composition/create-component-datasource.js";
import { addRenderingToPlaceholderPowershellTool } from "./tools/powershell/composite/composition/add-rendering-to-placeholder.js";
import { listSitesPowershellTool } from "./tools/powershell/composite/composition/list-sites.js";
import { getPagesBySitePowershellTool } from "./tools/powershell/composite/composition/get-pages-by-site.js";
import { listSiteComponentsPowershellTool } from "./tools/powershell/composite/composition/list-site-components.js";
import { listInsertOptionsPowershellTool } from "./tools/powershell/composite/composition/list-insert-options.js";
import {
    isGroupEnabled,
    reportUnmatchedTools,
    resolveToolGating,
    withToolGating,
    type ToolGating,
    type ToolGroup,
} from "./tool-profiles.js";

export async function register(array: Array<(server: McpServer, config: Config) => void>,
    server: McpServer,
    config: Config) {
    for (const register of array) {
        await register(server, config);
    }
}

type ToolRegistrar = (server: McpServer, config: Config) => void;

/**
 * The registrars, grouped exactly as the tools are laid out on disk. The grouping is
 * what `TOOL_GROUPS` and `TOOL_PROFILE` select over, and skipping a group here skips
 * its registrars' startup cost (schema introspection, index lookups) as well as their
 * schemas. Registration order matches the flat list this replaced.
 */
export const TOOL_GROUP_REGISTRARS: Record<ToolGroup, ToolRegistrar[]> = {
    "graphql": [
        registerGraphQL,
    ],

    "item-service": [
        //Simple Item Service Tools
        getItemTool,
        getItemChildrenTool,
        createItemTool,
        editItemTool,
        deleteItemTool,
        searchItemsTool,
        runStoredQueryTool,
        runStoredSearchTool,

        //Composite Item Service Tools
        getItemDescendantsTool,
        getLanguagesTool,
    ],

    "powershell.core": [
        getPowershellDocumentationTool,
        runPowershellScriptTool,
    ],

    "powershell.composition": [
        getAllowedComponentsByPlaceholderPowershellTool,
        createComponentDatasourcePowershellTool,
        addRenderingToPlaceholderPowershellTool,
        listSitesPowershellTool,
        getPagesBySitePowershellTool,
        listSiteComponentsPowershellTool,
        listInsertOptionsPowershellTool,
    ],

    "powershell.security": [
        //Simple Security PowerShell Tools
        getUserByIdentityPowerShellTool,
        getCurrentUserPowerShellTool,
        getUserByFilterPowerShellTool,
        newUserPowerShellTool,
        removeUserPowerShellTool,
        disableUserPowerShellTool,
        enableUserPowerShellTool,
        unlockUserPowerShellTool,
        setUserPowerShellTool,
        setUserPasswordPowerShellTool,
        exportUserPowerShellTool,
        importUserPowerShellTool,
        exportRolePowerShellTool,
        importRolePowerShellTool,
        getDomainByNamePowerShellTool,
        getAllDomainsPowerShellTool,
        getRoleByIdentityPowerShellTool,
        getRoleByFilterPowerShellTool,
        getRoleMemberPowerShellTool,
        addRoleMemberPowerShellTool,
        removeRoleMemberPowerShellTool,
        lockItemPowerShellTool,
        unlockItemPowerShellTool,
        protectItemPowerShellTool,
        unprotectItemPowerShellTool,
        newRolePowerShellTool,
        removeRolePowerShellTool,
        newDomainPowerShellTool,
        removeDomainPowerShellTool,
        testAccountPowerShellTool,
        getItemAclPowerShellTool,
        testItemAclPowerShellTool,
        addItemAclPowerShellTool,
        clearItemAclPowerShellTool,

        //Composite Security PowerShell Tools
        setItemAclPowerShellTool,
    ],

    "powershell.common": [
        //Simple Common PowerShell Tools
        addBaseTemplatePowerShellTool,
        addItemVersionPowerShellTool,
        convertFromItemClonePowerShellTool,
        getCachePowerShellTool,
        getDatabasePowerShellTool,
        getItemClonePowerShellTool,
        getItemFieldPowerShellTool,
        getItemReferencePowerShellTool,
        getItemReferrerPowerShellTool,
        getItemTemplatePowerShellTool,
        getItemWorkflowEventPowerShellTool,
        getSitecoreJobPowerShellTool,
        invokeWorkflowPowerShellTool,
        newItemWorkflowEventPowerShellTool,
        publishItemPowerShellTool,
        removeBaseTemplatePowerShellTool,
        removeItemVersionPowerShellTool,
        resetItemFieldPowerShellTool,
        restartApplicationPowerShellTool,
        setItemTemplatePowerShellTool,
        testBaseTemplatePowerShellTool,

        //Composite Common PowerShell Tools
        getArchivePowerShellTool,
        getArchiveItemPowerShellTool,
        newItemClonePowerShellTool,
        removeArchiveItemPowerShellTool,
        restoreArchiveItemPowerShellTool,
        updateItemReferrerPowerShellTool,
    ],

    "powershell.presentation": [
        //Simple Presentation PowerShell Tools
        getLayoutPowershellTool,
        resetLayoutPowershellTool,
        mergeLayoutPowershellTool,
        getLayoutDevicePowershellTool,
        getDefaultLayoutDevicePowershellTool,
        getRenderingPowershellTool,
        removeRenderingPowershellTool,
        getPlaceholderSettingPowershellTool,
        removePlaceholderSettingPowershellTool,

        //Composite Presentation PowerShell Tools
        listRenderingsPowershellTool,
        setLayoutPowershellTool,
        addRenderingPowershellTool,
        setRenderingPowershellTool,
        switchRenderingPowershellTool,
        addPlaceholderSettingPowershellTool,
        getRenderingParameterPowershellTool,
        removeRenderingParameterPowershellTool,
        setRenderingParameterPowershellTool,
    ],

    "powershell.logging": [
        getLogsPowerShellTool,
    ],

    "powershell.provider": [
        getItemPowerShellTool,
    ],

    "powershell.indexing": [
        //Simple Indexing PowerShell Tools
        initializeSearchIndexPowerShellTool,
        getSearchIndexPowerShellTool,
        findItemPowerShellTool,
        resumeSearchIndexPowerShellTool,
        suspendSearchIndexPowerShellTool,
        stopSearchIndexPowerShellTool,

        //Composite Indexing PowerShell Tools
        initializeSearchIndexingItemPowerShellTool,
        removeSearchIndexItemPowerShellTool,
    ],

    "powershell.media": [
        mediaUploadTool,
        mediaDownloadTool,
    ],

    "sitecore-cli": [
        getSitecoreCliDocumentation,
    ],
};

export async function registerAll(server: McpServer, config: Config, gating?: ToolGating) {
    // `gating` is supplied by getServer, which applies the tool denylist before it
    // registers anything of its own. Resolve it here too so registerAll stays usable
    // on its own.
    let resolved = gating;
    if (!resolved) {
        resolved = resolveToolGating();
        withToolGating(server, resolved);
    }

    for (const group of Object.keys(TOOL_GROUP_REGISTRARS) as ToolGroup[]) {
        if (!isGroupEnabled(group, resolved)) {
            continue;
        }
        await register(TOOL_GROUP_REGISTRARS[group], server, config);
    }

    // Now that every name is known, say so if a denylist entry matched nothing.
    reportUnmatchedTools(resolved);
}
