import type { McpServer } from "@modelcontextprotocol/server";
import { isGroupEnabled, isToolEnabled, type ToolGating } from "../tool-profiles.js";
import { COMPOSE_PAGE_GUIDE } from "./compose-page.js";
import { BULK_UPDATE_GUIDE } from "./bulk-update.js";
import { DIAGNOSE_CONNECTION_GUIDE } from "./diagnose-connection.js";

/**
 * The server's `guide://` resources: the procedures several tools have to be run in the
 * right order to satisfy, which is not recoverable from their schemas.
 *
 * **Resources, not prompts.** These three were prompts as well, from the same strings,
 * and the prompt half is gone. A prompt is user-triggered and one-shot: somebody has to
 * know it exists, type it *before* the first tool call, and it cannot be consulted again
 * once injected — while the failures these bodies guard against surface mid-task, several
 * calls in, when an agent meets a Column Splitter, has to put a value in
 * `GridParameters`, or gets a 400 with an HTML body. A resource is the shape that fits
 * that: readable at the moment the question arises, re-readable, and reachable by an
 * agent that would never have gone looking through a prompt list. It also costs nothing
 * until it is read, same as before.
 *
 * **What replaces the discovery a prompt got for free.** A slash command puts itself in
 * front of the user; a resource has to be named somewhere the agent already reads. Three
 * places do that: `guide://tool-selection` (where the server's instructions send an agent
 * before it chooses a surface), and the descriptions of the two tools each guide is
 * about — `add-rendering-to-placeholder` names `guide://compose-page`, and
 * `run-powershell-script` names `guide://bulk-update`. Those two are the tools the agent
 * is already reading at the moment the guide becomes relevant, which is the only pointer
 * that reliably lands in time. Renaming a guide URI means fixing those descriptions too.
 *
 * Guides are gated on the same `ToolGating` the tools are. A procedure whose every step
 * names an absent tool is not a useful document, it is a misleading one.
 */
export function registerGuides(server: McpServer, gating: ToolGating): void {
    // The composition workflow is exactly the `powershell.composition` tool set, and
    // add-rendering-to-placeholder is the step it cannot be done without.
    if (isGroupEnabled("powershell.composition", gating)
        && isToolEnabled("add-rendering-to-placeholder", gating)) {
        registerGuide(
            server,
            "compose-page",
            "guide://compose-page",
            "Composing a page: placeholders, datasources and renderings",
            "The order the composition tools have to be run in, and the knowledge that makes "
            + "them safe: placeholder allow-lists, runtime placeholder paths and dynamic "
            + "placeholder IDs, SXA Container and Column/Row Splitter naming, and why "
            + "GridParameters and FieldNames are item references that must never be invented. "
            + "Read it before composing, and again mid-task — the splitter and grid cases are "
            + "the ones that come up several calls in.",
            COMPOSE_PAGE_GUIDE,
        );
    }

    // The bulk-update workflow is a run-powershell-script script; without that tool the
    // whole procedure has nothing to execute on.
    if (isGroupEnabled("powershell.core", gating)
        && isToolEnabled("run-powershell-script", gating)) {
        registerGuide(
            server,
            "bulk-update",
            "guide://bulk-update",
            "Updating many items safely with PowerShell",
            "The safe pattern for a mass write over run-powershell-script: resolve every ID "
            + "from the instance, root the scan at a named subtree, filter to the items that "
            + "actually need the change, dry-run and show the list before writing, bracket "
            + "edits in BeginEdit/EndEdit with a per-item try/catch, and handle versioned "
            + "fields one version at a time.",
            BULK_UPDATE_GUIDE,
        );
    }

    // Diagnosis stays available whatever is gated: which surfaces are absent is the
    // question it answers, so a partly disabled server is the case it is most wanted in.
    registerGuide(
        server,
        "diagnose-connection",
        "guide://diagnose-connection",
        "Diagnosing a Sitecore connection failure",
        "What a failing Sitecore call actually means: the cheapest probe for each of the four "
        + "surfaces, and the mapping from exact error text to the setting or environment "
        + "variable at fault — including the three signatures that read as the opposite of "
        + "their cause (the Authoring API's HTTP 200 on an unauthorized call, SPE's 400 with "
        + "an identity provider's HTML page, and the Item Service's two-caused 403).",
        DIAGNOSE_CONNECTION_GUIDE,
    );
}

function registerGuide(
    server: McpServer,
    name: string,
    uri: string,
    title: string,
    description: string,
    text: string,
): void {
    server.registerResource(
        name,
        uri,
        { title, description, mimeType: "text/markdown" },
        async (resourceUri) => ({
            contents: [{ uri: resourceUri.href, mimeType: "text/markdown", text }],
        }),
    );
}
