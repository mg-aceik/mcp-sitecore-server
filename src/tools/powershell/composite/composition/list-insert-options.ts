import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { safeMcpResponse } from "@/helper.js";
import { runGenericPowershellCommand } from "../../simple/generic.js";
import { SITE_SCOPE_FUNCTIONS, itemLookupExpression, itemLookupGuard, itemNotFoundMessage, itemSelectorInputSchema, missingSelectorMessage } from "./site-scope.js";
import { z } from "zod";

/**
 * What may be created under an item.
 *
 * Read from the item's `__Masters` field, which inherits from the template's standard
 * values and is where insert options are configured. The `uiGetMasters` pipeline would be
 * the more complete answer — it is what the Content Editor runs, and it is where insert
 * *rules* are evaluated — but it is not registered on an XM Cloud CM (verified: "Could not
 * get pipeline: uiGetMasters"), so the field is the portable answer. That difference is
 * stated in the tool description rather than hidden, because a project using insert rules
 * will see fewer options here than the editor shows.
 */
const DESCRIPTION =
    "Lists the insert options configured for an item — the templates and branches that may "
    + "be created under it — read from its __Masters field (which inherits from the "
    + "template's standard values). Each row reports Kind: 'Branch' items copy a whole "
    + "subtree, 'Template' items create a single item. Note that insert *rules* are not "
    + "evaluated (the uiGetMasters pipeline the Content Editor runs is not available on an "
    + "XM Cloud CM), so a project that uses them may see more options in the editor than "
    + "are listed here. IDs that resolve to no item are reported under Unresolved.";

export function listInsertOptionsPowershellTool(server: McpServer, config: Config) {
    server.registerTool(
        "list-insert-options",
        {
            description: DESCRIPTION,
            inputSchema: z.object({
                ...itemSelectorInputSchema,
            }),
        },
        async (params) => {
            const lookup = itemLookupExpression(params);
            if (!lookup) {
                return { isError: true, content: [{ type: "text", text: missingSelectorMessage("itemId") }] };
            }

            const command = `
${SITE_SCOPE_FUNCTIONS}
$item = ${lookup};
${itemLookupGuard("$item", itemNotFoundMessage("item"))}
$database = $item.Database.Name;
$ids = @(Get-McpDelimitedList -Value $item['__Masters']);
$resolved = @();
$unresolved = @();
$seen = @{};
foreach ($id in $ids) {
    if ($seen.ContainsKey($id)) { continue }
    $seen[$id] = 1;
    $master = $null;
    try { $master = Get-Item -Path ($database + ':') -ID $id -ErrorAction SilentlyContinue } catch { $master = $null }
    if ($null -eq $master) { $unresolved += $id; continue }
    $kind = 'Other';
    if ($master.TemplateName -eq 'Branch') { $kind = 'Branch' }
    elseif ($master.TemplateName -eq 'Template') { $kind = 'Template' }
    $resolved += [PSCustomObject]@{
        ID = $master.ID.ToString();
        Name = $master.Name;
        Path = $master.Paths.FullPath;
        Kind = $kind;
    };
}
[PSCustomObject]@{
    ItemPath = $item.Paths.FullPath;
    ItemID = $item.ID.ToString();
    InsertOptions = $resolved;
    Unresolved = $unresolved;
};
`;
            return safeMcpResponse(runGenericPowershellCommand(config, command, {}));
        }
    );
}
