import type { McpServer } from "@modelcontextprotocol/server";
import { isGroupEnabled, isToolEnabled, type ToolGating } from "../tool-profiles.js";
import { addComponentToPagePrompt } from "./add-component-to-page.js";
import { bulkUpdateItemsPrompt } from "./bulk-update-items.js";
import { diagnoseConnectionPrompt } from "./diagnose-connection.js";

/**
 * The server's prompts: the workflows the tools can perform but do not encode.
 *
 * Prompts cost nothing until a user picks one — unlike the server `instructions`, which
 * are paid every session — so this is where guidance belongs that is only needed when
 * somebody is actually doing the task. `guide://tool-selection` is the same trade for
 * routing knowledge.
 *
 * They are gated on the same `ToolGating` the tools are. Offering
 * `add-component-to-page` on an instance whose composition tools were withheld would
 * advertise a workflow whose first call does not exist, which is worse than not offering
 * it: the user picks it, and the agent fails halfway through.
 */
export function registerPrompts(server: McpServer, gating: ToolGating): void {
    // The composition workflow is exactly the `powershell.composition` tool set, and
    // add-rendering-to-placeholder is the step it cannot be done without.
    if (isGroupEnabled("powershell.composition", gating)
        && isToolEnabled("add-rendering-to-placeholder", gating)) {
        addComponentToPagePrompt(server);
    }

    // The bulk-update workflow is a run-powershell-script script; without that tool the
    // whole procedure has nothing to execute on.
    if (isGroupEnabled("powershell.core", gating)
        && isToolEnabled("run-powershell-script", gating)) {
        bulkUpdateItemsPrompt(server);
    }

    // Diagnosis stays available whatever is gated: which surfaces are absent is the
    // question it answers, so a partly disabled server is the case it is most wanted in.
    diagnoseConnectionPrompt(server);
}
