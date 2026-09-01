import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { hasTarget, requireOneTarget } from "@/tools/target-input.js";
import { runGenericPowershellCommand } from "../generic.js";
import { ITEM_DATABASE_DESCRIPTION, getSwitchParameterValue } from "../../utils.js";
import { itemProjectionPipeline, itemProjectionInputSchema } from "../../projection.js";

export function addItemVersionPowerShellTool(server: McpServer, config: Config) {
    server.registerTool(
        "common-add-item-version",
        {
            description: "Creates a version of the item in a new language based on an existing language version.",
            inputSchema: z.object({
                id: z.string().optional()
                    .describe("The id of the item to add version for. Supply this or path."),
                path: z.string().optional()
                    .describe("The path of the item to add version for (e.g. /sitecore/content/Home). Supply this or id."),
                language: z.string().optional()
                    .describe("Language that will be used as source language. If not specified the current user language will be used."),
                targetLanguage: z.string().optional()
                    .describe("Language that should be created."),
                recurse: z.boolean().optional()
                    .describe("Process the item and all of its children."),
                ifExist: z.enum(["Append", "Skip", "OverwriteLatest"]).default("Append"),
                ifNoSourceVersion: z.enum(["Skip", "Add"]).default("Skip"),
                doNotCopyFields: z.boolean().optional()
                    .describe("Creates a new version in the target language but does not copy field values from the original language."),
                ignoredFields: z.array(z.string()).optional()
                    .describe("List of fields that should not be copied over from original item."),
                database: z.string().optional()
                    .describe(ITEM_DATABASE_DESCRIPTION),
                ...itemProjectionInputSchema,
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
            const command = `Add-ItemVersion`;

            if (params.language) {
                options["Language"] = params.language;
            }
            
            if (params.targetLanguage) {
                options["TargetLanguage"] = params.targetLanguage;
            }

            if (params.recurse) {
                options["Recurse"] = getSwitchParameterValue(params.recurse);
            }

            if (params.ifExist) {
                options["IfExist"] = params.ifExist;
            }

            if (params.ifNoSourceVersion) {
                options["IfNoSourceVersion"] = params.ifNoSourceVersion;
            }

            if (params.doNotCopyFields) {
                options["DoNotCopyFields"] = getSwitchParameterValue(params.doNotCopyFields);
            }

            if (params.ignoredFields && params.ignoredFields.length > 0) {
                options["IgnoredFields"] = params.ignoredFields;
            }

            if (params.database) {
                options["Database"] = params.database;
            }

            // Add-ItemVersion returns the item it versioned. Unprojected that measured
            // 47,459 characters -- the projection here is the same one the common-get-*
            // read tools already apply; this write tool had simply been missed.
            const pipeline = itemProjectionPipeline(params);

            return safeMcpResponse(
                runGenericPowershellCommand(config, command, options, undefined, {
                    pipeline,
                    full: params.full,
                })
            );
        }
    );
}
