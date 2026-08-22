import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { safeMcpResponse } from "@/helper.js";
import { runGenericPowershellCommand } from "../../simple/generic.js";
import { quotePowerShellString } from "../../command-builder.js";
import {
    SITE_SCOPE_FUNCTIONS,
    itemLookupExpression,
    itemLookupGuard,
    itemNotFoundMessage,
    missingSelectorMessage,
    pageSelectorInputSchema,
} from "./site-scope.js";
import {
    PLACEHOLDER_SETTINGS_FUNCTIONS,
    placeholderResolutionInputSchema,
} from "./placeholder-settings.js";
import { z } from "zod";

/**
 * Answers "what may I put here?" for one placeholder on one page.
 *
 * This is the presentation knowledge the server was missing. Without it an agent can
 * write a structurally invalid page — a `RichText` straight into `headless-main`, which
 * that placeholder does not allow — and nothing objects: the page saves, renders, and
 * passes every field-level check. The allow-list is plainly readable from the CM, in two
 * layers, and `placeholder-settings.ts` documents how.
 */
const DESCRIPTION =
    "Lists the renderings a placeholder allows on a given page, read from the placeholder "
    + "settings items that govern it. Call this before adding a rendering: a placeholder "
    + "that forbids a component will still accept it silently, and the page will render. "
    + "Resolves site-level settings first (<site>/Presentation/Placeholder Settings) and "
    + "falls back to the global tree (/sitecore/layout/Placeholder Settings/Project/...); "
    + "settingsItemPath in the result says which item answered. Handles dynamic "
    + "placeholders: a runtime path like /headless-main/page-section-1/container-2 is "
    + "matched on its leaf segment against wildcard keys such as container-{*}. Allowed "
    + "control IDs that resolve to no item are reported under 'Unresolved' rather than "
    + "dropped silently — that is a content defect worth seeing. Found=false means no "
    + "settings item governs the key, so check the spelling before treating it as "
    + "unrestricted.";

export function getAllowedComponentsByPlaceholderPowershellTool(server: McpServer, config: Config) {
    server.registerTool(
        "get-allowed-components-by-placeholder",
        {
            description: DESCRIPTION,
            inputSchema: z.object({
                ...pageSelectorInputSchema,
                ...placeholderResolutionInputSchema,
            }),
        },
        async (params) => {
            const lookup = itemLookupExpression(params);
            if (!lookup) {
                return { isError: true, content: [{ type: "text", text: missingSelectorMessage("pageId") }] };
            }

            const command = `
${SITE_SCOPE_FUNCTIONS}
${PLACEHOLDER_SETTINGS_FUNCTIONS}
$item = ${lookup};
${itemLookupGuard("$item", itemNotFoundMessage("item"))}
Get-McpAllowedComponents -Item $item -PlaceholderPath ${quotePowerShellString(params.placeholderPath)} -Project ${quotePowerShellString(params.project ?? "")};
`;

            return safeMcpResponse(runGenericPowershellCommand(config, command, {}));
        }
    );
}
