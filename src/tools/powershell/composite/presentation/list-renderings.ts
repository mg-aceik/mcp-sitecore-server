import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { hasTarget, requireOneTarget } from "@/tools/target-input.js";
import { runGenericPowershellCommand } from "../../simple/generic.js";
import { PowershellCommandBuilder, quotePowerShellString } from "../../command-builder.js";
import { getFinalLayoutSwitchValue } from "../../utils.js";
import { renderingLookupGuard } from "./rendering-guard.js";

/**
 * Lists the renderings placed on a page as structured rows.
 *
 * `presentation-get-layout` calls `Get-Layout`, which is faithful to SPE — it
 * returns the layout *definition* item — but it is not the question agents ask. Called
 * on a page it described the `Headless Layout` item in 35,573 characters and said
 * nothing about the page's renderings. This is the sibling that answers the real
 * question.
 *
 * Rendering IDs are resolved to names in one batched pass over the *distinct* IDs rather
 * than one `Get-Item` per rendering instance: a page with 33 renderings drawn from a
 * dozen component types costs a dozen lookups, not 33.
 */
const ROW_DESCRIPTION =
    "Returns one row per rendering: Index (position in the device's rendering list, which "
    + "is what presentation-add-rendering and presentation-set-rendering address), "
    + "Placeholder (the full placeholder path), RenderingName, RenderingID, Datasource and "
    + "UniqueId. Set includeParameters to add each rendering's Parameters.";

const INCLUDE_PARAMETERS_DESCRIPTION =
    "Include each rendering's raw Parameters string. Off by default: on an SXA or Stride "
    + "site the URL-encoded parameter blobs are the largest part of the response by far "
    + "(they more than doubled a 25-rendering page), and they are rarely what the caller "
    + "is after. Use presentation-get-rendering-parameter to read a single one.";

const FINAL_LAYOUT_DESCRIPTION =
    "Which layout to read. Defaults to true (the final layout), which is the effective "
    + "presentation for the page. Set false to read the shared layout only.";

type ListRenderingsParams = {
    placeholder?: string;
    language?: string;
    finalLayout?: boolean;
    includeParameters?: boolean;
};

/**
 * Builds the script. `itemLookup` is the `Get-Item` call that resolves the page; the rest
 * is the same for both tools.
 */
function buildListRenderingsCommand(itemLookup: string, params: ListRenderingsParams): string {
    const filters: Record<string, any> = {
        PlaceHolder: params.placeholder,
        Language: params.language,
        // `finalLayout` defaults to true: the final layout is the effective presentation,
        // and "what is on this page" is what the caller is asking.
        FinalLayout: getFinalLayoutSwitchValue(params.finalLayout),
    };
    const getRenderingParameters = new PowershellCommandBuilder().buildParametersString(filters);

    // Kept out of the projection unless asked for: see INCLUDE_PARAMETERS_DESCRIPTION.
    const parametersRow = params.includeParameters
        ? "\n        Parameters = $rendering.Parameters;"
        : "";

    const notFound =
        "No item was found for the supplied path or ID. Verify the path or ID, the database "
        + "and the language, and that the item exists in that language.";

    return `
$item = ${itemLookup};
${renderingLookupGuard("$item", notFound)}
$renderings = @(Get-Rendering -Item $item${getRenderingParameters});
$names = @{};
foreach ($rendering in $renderings) {
    if ($rendering.ItemID) { $names[$rendering.ItemID] = '' }
}
foreach ($renderingId in @($names.Keys)) {
    $renderingItem = Get-Item -Path ($item.Database.Name + ':') -ID $renderingId -ErrorAction SilentlyContinue;
    if ($renderingItem) { $names[$renderingId] = $renderingItem.Name }
}
for ($index = 0; $index -lt $renderings.Count; $index++) {
    $rendering = $renderings[$index];
    $renderingName = '';
    if ($rendering.ItemID) { $renderingName = $names[$rendering.ItemID] }
    [PSCustomObject]@{
        Index = $index;
        Placeholder = $rendering.Placeholder;
        RenderingName = $renderingName;
        RenderingID = $rendering.ItemID;
        Datasource = $rendering.Datasource;
        UniqueId = $rendering.UniqueId;${parametersRow}
    }
}
`;
}

export function listRenderingsPowershellTool(server: McpServer, config: Config) {
    server.registerTool(
        "presentation-list-renderings",
        {
            description:
                "Lists the renderings placed on an item — the components that make up the page. "
                + "This is the tool to use to see a page's composition; presentation-get-layout "
                + `returns the assigned layout definition item instead. ${ROW_DESCRIPTION}`,
            inputSchema: z.object({
                id: z.string().optional()
                    .describe("The ID of the item whose renderings to list (e.g. {110D559F-DEA5-42EA-9C1C-8A5DF7E70EF9}). Supply this or path."),
                path: z.string().optional()
                    .describe("The path of the item whose renderings to list (e.g. master:/sitecore/content/Home). Supply this or id."),
                database: z.string().optional()
                    .describe("The database containing the item. Defaults to master, and is only used with id — a path carries its own prefix."),
                placeholder: z.string().optional().describe("Only list renderings in this placeholder. Supports wildcards, e.g. '*main*'."),
                language: z.string().optional().describe("The item language. Defaults to the context language."),
                finalLayout: z.boolean().optional().describe(FINAL_LAYOUT_DESCRIPTION),
                includeParameters: z.boolean().optional().describe(INCLUDE_PARAMETERS_DESCRIPTION),
            }),
        },
        async (params) => {
            const invalid = requireOneTarget(params, ["id", "path"]);
            if (invalid) {
                return invalid;
            }

            const language = params.language ? ` -Language ${quotePowerShellString(params.language)}` : "";
            const target = hasTarget(params.id)
                ? `Get-Item -Path ${quotePowerShellString(`${params.database || "master"}:`)} -ID ${quotePowerShellString(params.id)}`
                : `Get-Item -Path ${quotePowerShellString(params.path)}`;

            const itemLookup = `${target}${language} -ErrorAction SilentlyContinue`;

            const command = buildListRenderingsCommand(itemLookup, params);
            return safeMcpResponse(runGenericPowershellCommand(config, command, {}));
        }
    );
}
