import type { McpServer } from "@modelcontextprotocol/server";
import { safeMcpResponse } from "@/helper.js";
import type { Config } from "@/config.js";
import { z } from "zod";
import { runGenericPowershellCommand } from "./simple/generic.js";

// The pointer is the whole reason this description is longer than one line. A mass
// write is the dangerous thing this tool is routinely asked for, and the safe pattern for
// it -- resolve every ID, root the scan, dry run first -- used to reach an agent only if a
// user invoked a prompt. Naming the resource here puts it in front of the model at the
// moment it is reading the tool it would write that script with, which is the only place
// the pointer reliably lands. The guide is registered by `src/guides/register-guides.ts`
// under the same gating as this tool, so it is there whenever this description is.
const DESCRIPTION =
    "Runs a PowerShell script and returns the output. Before writing a script that changes "
    + "many items, read the guide://bulk-update resource: it carries the pattern a mass "
    + "write needs (every ID resolved from the instance, a named subtree as the root, a dry "
    + "run the user approves, BeginEdit/EndEdit with a per-item try/catch).";

export function runPowershellScriptTool(server: McpServer, config: Config) {
    server.registerTool(
        "run-powershell-script",
        {
            description: DESCRIPTION,
            inputSchema: z.object({
                script: z.string()
                    .describe("The Powershell script to run."),
            }),
        },
        async (params) => {
            const command = params.script;
            return safeMcpResponse(runGenericPowershellCommand(config, command, {}));
        }
    );
}