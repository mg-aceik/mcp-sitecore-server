import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { hasTarget, requireOneTarget } from "@/tools/target-input.js";
import { runGenericPowershellCommand } from "../generic.js";
import { ITEM_DATABASE_DESCRIPTION, getSwitchParameterValue } from "../../utils.js";

export function publishItemPowerShellTool(server: McpServer, config: Config) {
    server.registerTool(
        "common-publish-item",
        {
            description: "Publishes a Sitecore item. On SitecoreAI there is no web database — content publishes to Edge, which lives on Sitecore's cloud servers only, so this works on deployed environments but a local development CM has no publishing target.",
            inputSchema: z.object({
                id: z.string().optional()
                    .describe("The ID of the item that should be published. Supply this or path."),
                path: z.string().optional()
                    .describe("The path of the item that should be published. Supply this or id."),
                target: z.string().optional()
                    .describe("Specifies the publishing target. The default target database is 'web'."),
                recurse: z.boolean().optional()
                    .describe("Publishes the subitems with the root item."),
                publishMode: z.enum(["Full", "Incremental", "SingleItem", "Smart"]).optional()
                    .describe("Specifies the Publish mode."),
                publishRelatedItems: z.boolean().optional()
                    .describe("Publishes the related items."),
                republishAll: z.boolean().optional()
                    .describe("Republishes all items provided to the publishing job."),
                compareRevisions: z.boolean().optional()
                    .describe("Turns revision comparison on."),
                fromDate: z.string().optional()
                    .describe("Publishes items newer than the date provided only. An ISO 8601 date or date-time, e.g. '2026-01-31' or '2026-01-31T09:00:00Z'."),
                asJob : z.boolean().optional()
                    .describe("The Sitecore API called to perform the publish is different with this parameter."),
                language: z.string().optional()
                    .describe("The language of the item that should be published. Supports globbing/wildcards."),
                database: z.string().optional()
                    .describe(ITEM_DATABASE_DESCRIPTION)
            }),
        },
        async (params) => {
            const invalid = requireOneTarget(params, ["id", "path"]);
            if (invalid) {
                return invalid;
            }

            const options: Record<string, any> = {
                ...(hasTarget(params.id) ? { "Id": params.id } : { "Path": params.path }),
            };
            const command = `Publish-Item`;

            if (params.target) {
                options["Target"] = params.target;
            }

            if (params.recurse) {
                options["Recurse"] = getSwitchParameterValue(params.recurse);
            }

            if (params.publishMode) {
                options["PublishMode"] = params.publishMode;
            }

            if (params.publishRelatedItems) {
                options["PublishRelatedItems"] = getSwitchParameterValue(params.publishRelatedItems);
            }
            
            if (params.republishAll) {
                options["RepublishAll"] = getSwitchParameterValue(params.republishAll);
            }

            if (params.compareRevisions) {
                options["CompareRevisions"] = getSwitchParameterValue(params.compareRevisions);
            }

            if (params.fromDate) {
                options["FromDate"] = params.fromDate;
            }

            if (params.asJob) {
                options["AsJob"] = getSwitchParameterValue(params.asJob);
            }

            if (params.language) {
                options["Language"] = params.language;
            }

            if (params.database) {
                options["Database"] = params.database;
            }

            return safeMcpResponse(runGenericPowershellCommand(config, command, options));
        }
    );
}