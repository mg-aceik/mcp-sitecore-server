import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { runAuthoringOperation } from "../logic/run.js";

/**
 * Site queries over the Authoring and Management API.
 *
 * `authoring-list-sites` is the usual first call of a session: it hands back each site's
 * root path and root item ID, which is what every later path or `_path` search criterion is
 * built from. The SPE equivalent (`composition-list-sites`) reads the same definitions
 * through a script; this route needs no SPE Remoting.
 */

export function authoringListSitesTool(server: McpServer, config: Config) {
    server.registerTool(
        "authoring-list-sites",
        {
            description:
                "Lists the sites configured on the Sitecore instance over the Authoring and "
                + "Management API, with each site's root path, start path and root item ID. Usually "
                + "the first call when working on an instance you have not seen: the root item ID is "
                + "what authoring-search scopes a subtree search by, and the root path is what item "
                + "paths hang off. System sites (shell, admin, login and the rest) are hidden unless "
                + "includeSystemSites is set.",
            inputSchema: z.object({
                includeSystemSites: z.boolean().optional()
                    .describe("When true, also return Sitecore's own internal sites (shell, login, admin, service). Off by default."),
            }),
        },
        (params) => {
            const query = `
                query ListSites($includeSystemSites: Boolean) {
                  sites(includeSystemSites: $includeSystemSites) {
                    name
                    hostName
                    domain
                    language
                    rootPath
                    startPath
                    startItem { itemId name path }
                    rootItem { itemId name path }
                    database { name }
                    contentDatabase { name }
                    enablePreview
                    enableWebEdit
                    enableWorkflow
                  }
                }`;

            return safeMcpResponse(runAuthoringOperation(config, query, {
                includeSystemSites: params.includeSystemSites,
            }));
        }
    );
}

export function authoringGetSiteTool(server: McpServer, config: Config) {
    server.registerTool(
        "authoring-get-site",
        {
            description:
                "Reads one site's configuration by name over the Authoring and Management API — "
                + "paths, database, language, device and the editing switches. Use "
                + "authoring-list-sites first if you do not know the site's name.",
            inputSchema: z.object({
                siteName: z.string().describe("The site's name as configured, e.g. 'website'."),
            }),
        },
        (params) => {
            const query = `
                query GetSite($siteName: String!) {
                  site(siteName: $siteName) {
                    name
                    hostName
                    targetHostName
                    domain
                    language
                    browserTitle
                    rootPath
                    startPath
                    contentStartPath
                    startItem { itemId name path }
                    rootItem { itemId name path }
                    database { name }
                    contentDatabase { name }
                    contentLanguage { name }
                    defaultDevice
                    device
                    dictionaryDomain
                    loginPage
                    requireLogin
                    enablePreview
                    enableWebEdit
                    enableWorkflow
                    enableDebugger
                    cacheMedia
                    filterItems
                    properties { key value }
                  }
                }`;

            return safeMcpResponse(runAuthoringOperation(config, query, {
                siteName: params.siteName,
            }));
        }
    );
}
