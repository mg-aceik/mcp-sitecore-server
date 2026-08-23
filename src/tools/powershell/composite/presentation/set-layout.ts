import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { hasTarget, requireOneTarget } from "@/tools/target-input.js";
import { runGenericPowershellCommand } from "../../simple/generic.js";
import { quotePowerShellString } from "../../command-builder.js";

export function setLayoutPowershellTool(server: McpServer, config: Config) {
    server.registerTool(
        "presentation-set-layout",
        {
            description: "Sets layout for an item.",
            inputSchema: z.object({
                id: z.string().optional()
                    .describe("The ID of the item to set the layout for. Supply this or path."),
                path: z.string().optional()
                    .describe("The path of the item to set the layout for. Supply this or id."),
                layoutId: z.string().optional()
                    .describe("The ID of the layout to set for the item. Supply this or layoutPath."),
                layoutPath: z.string().optional()
                    .describe("The path of the layout to set for the item. Supply this or layoutId."),
                database: z.string()
                    .describe("The database the layout is read from. Only used with layoutId; layoutPath carries its own prefix (e.g. master:/sitecore/layout/...).")
                    .optional().default("master"),
                language: z.string().describe("The language of the item to set layout for.").optional(),
                finalLayout: z
                    .boolean()
                    .describe("Specifies layout to be updated. If 'true', the final layout is set, otherwise - shared layout.")
                    .optional(),
            }),
        },
        async (params) => {
            // Two independent targets: the item whose layout is set, and the layout item.
            const invalidItem = requireOneTarget(params, ["id", "path"]);
            if (invalidItem) {
                return invalidItem;
            }

            const invalidLayout = requireOneTarget(params, ["layoutId", "layoutPath"]);
            if (invalidLayout) {
                return invalidLayout;
            }

            const layoutLookup = params.layoutId
                ? `Get-Item -Path ${quotePowerShellString(`${params.database}:`)} -Id ${quotePowerShellString(params.layoutId)}`
                : `Get-Item -Path ${quotePowerShellString(params.layoutPath)}`;

            const target = hasTarget(params.id)
                ? `-Id ${quotePowerShellString(params.id)}`
                : `-Path ${quotePowerShellString(params.path)}`;

            const command = `
                $layout = ${layoutLookup};
                $device = Get-LayoutDevice -Default;
                Set-Layout ${target} -Layout $layout -Device $device ${params.language ? `-Language ${quotePowerShellString(params.language)}` : ""}
                    ${params.finalLayout ? "-FinalLayout" : ""};
            `.replaceAll(/[\n]+/g, "");

            return safeMcpResponse(runGenericPowershellCommand(config, command, {}));
        }
    );
}
