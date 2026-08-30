import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

/**
 * Bulk-updating items with an SPE script, written for an agent that has
 * `run-powershell-script` but not the discipline that makes a mass write safe.
 *
 * The individual write tools are fine for one item; at fifty items the risks change
 * shape. A wrong filter updates the wrong subtree, a guessed GUID matches nothing (or
 * worse, something), and a script that writes on its first run gives the user no chance
 * to catch either. The script pattern below is the generic form of the scripts Sitecore
 * developers actually write for this: config block, pre-flight checks, collect, filter to
 * the items that *need* the change, dry run, edit loop, summary.
 *
 * The parts worth stating explicitly, because they are what people and models get wrong:
 *
 * - **The dry run is a separate execution, not a code path to skip.** The script ships
 *   with `$dryRun = $true` and the agent must show the user what would change and get a
 *   yes before rerunning with `$false`. Combining both into one run defeats the point.
 * - **Every GUID must be resolved, never guessed.** A template ID, a rendering ID, a
 *   standard-values ID — each is one `find-item` / `item-service-get-item` call away, and
 *   a fabricated one either matches nothing or silently matches the wrong thing.
 * - **Resetting a field to its template default has two meanings.** `.Reset()` restores
 *   inheritance, so later standard-values changes flow through; copying the standard
 *   values text freezes today's value onto the item. The example this prompt generalises
 *   copied the text; most of the time `.Reset()` is what was actually wanted.
 * - **This runs over SPE Remoting, not the ISE.** `Write-Progress` and console colors go
 *   nowhere, and every output line travels back in the response — so emit plain lines,
 *   cap the per-item listing, and end with counts.
 */

const DESCRIPTION =
    "Bulk-update Sitecore items with a PowerShell script that follows the safe pattern: "
    + "resolve every ID first, pre-flight check, filter to the items that actually need the "
    + "change, dry-run and show the list, get explicit confirmation, then edit inside "
    + "BeginEdit/EndEdit with a per-item try/catch and a final summary.";

const GUIDANCE = `
## Order

1. **Resolve every identifier with a tool call before writing the script.** The root item
   (\`item-service-get-item\` or \`get-item\` by path), the template ID, and any rendering
   or standard-values IDs the filter or the change refers to (\`find-item\`,
   \`item-service-search-items\`, or read them off a known item). Never type a GUID you
   have not read back from the instance.
2. **Write the script from the template below** and run it with \`run-powershell-script\`
   with \`$dryRun = $true\`.
3. **Show the user the dry-run output** — the count and the matched paths — and get an
   explicit yes. If the count or the paths look wrong, fix the filter, not the safeguard.
4. **Rerun with \`$dryRun = $false\`**, then report the summary counts and any per-item
   errors verbatim.
5. Changes land in \`master\` unversioned by workflow and unpublished. Say so, and treat
   publishing as a separate decision the user makes.

## The script template

Adapt the config block, the filter and the change; keep the structure.

\`\`\`powershell
# Set to $false only after the dry-run output has been reviewed and approved.
$dryRun = $true

# --- Configuration: every value here was resolved from the instance, not guessed ---
$rootPath   = "/sitecore/content/<tenant>/<site>/Home"
$templateId = "{...}"    # template of the items to update
# Any IDs the filter or change needs, normalised for raw-value matching:
# $renderingIdNorm = "{...}".Trim('{','}').ToUpperInvariant()

# --- Pre-flight: verify everything the script depends on, exit early and loudly ---
$root = Get-Item -Path "master:$rootPath" -ErrorAction SilentlyContinue
if ($null -eq $root) { Write-Output "ERROR: root not found: $rootPath"; exit }

# --- Collect: the items of the target template under the root ---
$candidates = Get-ChildItem -Path "master:$rootPath" -Recurse -ErrorAction SilentlyContinue |
    Where-Object { $_.TemplateID -eq [Sitecore.Data.ID]::Parse($templateId) }

# --- Filter: only the items that actually NEED the change (makes reruns idempotent) ---
$targets = $candidates | Where-Object {
    $value = $_.Fields["__Final Renderings"].Value
    (-not [string]::IsNullOrWhiteSpace($value)) -and
    ($value.ToUpperInvariant().Contains($renderingIdNorm))
}

Write-Output "Candidates: $($candidates.Count)  Need the change: $($targets.Count)"

if ($dryRun) {
    $targets | Select-Object -First 50 | ForEach-Object { Write-Output $_.Paths.Path }
    if ($targets.Count -gt 50) { Write-Output "... and $($targets.Count - 50) more" }
    Write-Output "DRY RUN - no items were changed."
    exit
}

# --- Update loop: every edit bracketed, every failure caught and counted ---
$updated = 0
$failed  = 0
foreach ($item in $targets) {
    try {
        $item.Editing.BeginEdit()
        # The change goes here, e.g. reset a field to its template default:
        $item.Fields["__Final Renderings"].Reset()
        $item.Editing.EndEdit() | Out-Null
        $updated++
    }
    catch {
        $item.Editing.CancelEdit()
        Write-Output "ERROR $($item.Paths.Path): $($_.Exception.Message)"
        $failed++
    }
}

Write-Output "Updated: $updated  Failed: $failed  Targeted: $($targets.Count)"
\`\`\`

## Rules the template encodes

- **Dry run first, as a separate execution.** \`$dryRun = $true\` is the shipped state.
  Show the user what would change and get an explicit yes before rerunning with
  \`$false\`. Do not merge the two runs, and do not flip the default.
- **Filter to items that need the change, not just items of the type.** The candidate
  set is "every item of the template"; the target set is "every item whose current value
  is wrong". The second makes the script idempotent and the dry-run count meaningful.
- **Compare template IDs as IDs** — \`[Sitecore.Data.ID]::Parse\` — not names, which are
  not unique. To include items of derived templates, compare against
  \`$_.Template.BaseTemplates\` too, deliberately.
- **Normalise GUIDs before matching raw field text.** Layout and link fields store XML;
  match with braces stripped and case fixed, as \`$renderingIdNorm\` does.
- **\`.Reset()\` versus copying a value.** \`$item.Fields[$name].Reset()\` restores
  inheritance from standard values, so future template changes flow through. Writing the
  standard-values text into the field freezes today's value. Ask which the user means;
  default to \`.Reset()\`.
- **Versioned and language fields touch one version.** \`Get-ChildItem\` returns the
  current language's latest version, and \`__Final Renderings\` is versioned and
  per-language. To update every version or language, enumerate with
  \`Get-Item -Language * -Version *\` — and say in the dry run which you are doing.
- **This runs over SPE Remoting, not the ISE.** No \`Write-Progress\`, no colors — plain
  \`Write-Output\` lines only, and everything you emit travels back in the response. Cap
  the listed paths (the template lists 50) and always end with counts.
- **Large trees:** \`Get-ChildItem -Recurse\` walks every item. Above roughly ten thousand
  descendants, narrow the root, or collect IDs with \`indexing-find-item\` /
  \`item-service-search-items\` first and process in batches, so a single
  \`run-powershell-script\` call stays inside its timeout.
- **Scope is a named subtree, always.** Never run an unrooted or \`/sitecore\`-rooted
  bulk write. If the user's request has no root, ask for one.

## Reporting

After the real run, report: candidates, targeted, updated, failed, and every per-item
error verbatim. Remind the user the changes are unpublished, and offer the publish as a
follow-up rather than doing it unasked.
`;

export function bulkUpdateItemsPrompt(server: McpServer) {
    server.registerPrompt(
        "bulk-update-items",
        {
            title: "Bulk-update items with PowerShell",
            description: DESCRIPTION,
            argsSchema: z.object({
                change: z.string()
                    .describe("The change to make to each matching item, e.g. 'reset __Final Renderings to the template default' or 'set the Robots field to noindex'."),
                rootPath: z.string()
                    .describe("The subtree to update under, as a full content path (/sitecore/content/<tenant>/<site>/Home). Bulk writes are never run unrooted."),
                criteria: z.string().optional()
                    .describe("Which items qualify, e.g. 'Article Page items whose __Final Renderings contain the Related Pages rendering'. Omit to update every item of the relevant template under the root."),
            }),
        },
        ({ change, rootPath, criteria }) => {
            const scope = criteria
                ? `Only items matching: ${criteria}.`
                : `Establish with the user which items under the root qualify before writing the script.`;

            return {
                messages: [
                    {
                        role: "user" as const,
                        content: {
                            type: "text" as const,
                            text:
                                `Bulk-update Sitecore items under \`${rootPath}\`: ${change}. ${scope}\n\n`
                                + `Write the update as a PowerShell script for \`run-powershell-script\`, `
                                + `following the template and rules below. Resolve every ID from the `
                                + `instance first, run the dry run, show me what it matched, and wait for `
                                + `my confirmation before running the real update.\n`
                                + GUIDANCE,
                        },
                    },
                ],
            };
        }
    );
}
