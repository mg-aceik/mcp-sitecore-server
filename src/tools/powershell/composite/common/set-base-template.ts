import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { hasTarget, requireOneTarget } from "@/tools/target-input.js";
import { runGenericPowershellCommand } from "../../simple/generic.js";
import { ITEM_DATABASE_DESCRIPTION } from "../../utils.js";

/**
 * `common-add-base-template` and `common-remove-base-template` merged into one tool with an
 * `action`. Identical schemas, one cmdlet verb apart.
 *
 * The merged tool declares `destructiveHint: true` because `remove` is: dropping a base
 * template takes its fields off every item built from the template, and the field values go
 * with them. The name-based inference could distinguish add from remove when they were two
 * tools; with one tool the annotation has to cover the worse case.
 */
export function setBaseTemplatePowerShellTool(server: McpServer, config: Config) {
    server.registerTool(
        "common-set-base-template",
        {
            description:
                "Adds or removes a base template on a template item. Removing one takes its fields "
                + "off every item built from the template, along with their values.",
            annotations: {
                readOnlyHint: false,
                destructiveHint: true,
            },
            inputSchema: z.object({
                action: z.enum(["add", "remove"])
                    .describe("Whether to add the base template or remove it."),
                id: z.string().optional()
                    .describe("The ID of the template item. Supply this or path."),
                path: z.string().optional()
                    .describe("The path of the template item. Supply this or id."),
                template: z.string()
                    .describe("The path of the template item to add or remove as a base template."),
                database: z.string().optional().describe(ITEM_DATABASE_DESCRIPTION),
            }),
        },
        async (params) => {
            const invalid = requireOneTarget(params, ["id", "path"]);
            if (invalid) {
                return invalid;
            }

            const command = params.action === "add" ? `Add-BaseTemplate` : `Remove-BaseTemplate`;
            const options: Record<string, any> = {
                ...(hasTarget(params.id) ? { "Id": params.id } : { "Path": params.path }),
                "Template": params.template,
            };

            if (params.database) {
                options["Database"] = params.database;
            }

            return safeMcpResponse(runGenericPowershellCommand(config, command, options));
        }
    );
}
