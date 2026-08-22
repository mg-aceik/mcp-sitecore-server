import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Config } from "@/config.js";
import { PowershellClient } from "../client.js";
import { PowershellCommandBuilder } from "../command-builder.js";
import { PowerShellOutputType } from "../output.js";

/**
 * Response-shaping options for a single command run.
 */
export type PowershellShaping = {
    /**
     * A pipeline fragment (leading pipe included) appended to the command *after* its
     * parameters — normally a `Select-Object` projection from `projection.ts`. When set,
     * the parameters are rendered into the command string here rather than by the client,
     * because the projection has to come last.
     */
    pipeline?: string;
    /**
     * When true, return the raw serialized output unshaped. Callers pass the tool's own
     * `full` parameter through so one flag governs both response and error shaping.
     */
    full?: boolean;
};

export async function runGenericPowershellCommand(
    config: Config,
    command: string,
    options: Record<string, any>,
    outputFormat?: PowerShellOutputType,
    shaping?: PowershellShaping
): Promise<CallToolResult> {
    const client = new PowershellClient(
        config.powershell.serverUrl,
        config.powershell.username,
        config.powershell.password,
        config.powershell.domain
    );

    // A projection must be the last stage of the pipeline, so when one is supplied the
    // parameters are baked into the command string up front and the client is handed an
    // already-complete script. `buildCommandString` is exactly what the client would have
    // done with the parameters otherwise.
    let script = command;
    let scriptOptions = options;
    if (shaping?.pipeline) {
        script = new PowershellCommandBuilder().buildCommandString(command, options) + shaping.pipeline;
        scriptOptions = {};
    }

    let text = ""
    let isError = false;
    switch (outputFormat) {
        case PowerShellOutputType.JSON:
            text = await client.executeScriptJson(script, scriptOptions);
            const json1 = JSON.parse(text);
            isError = json1?.Obj?.[0]?.ErrorCategory_Message !== undefined;
            break;
        case PowerShellOutputType.XML:
            text = await client.executeScript(script, scriptOptions);
            isError = text.includes("Error");
            break;
        default:
            text = await client.executeScriptJson(script, scriptOptions);
            const json2 = JSON.parse(text);
            isError = json2?.Obj?.[0]?.ErrorCategory_Message !== undefined;
            break;
    }

    return {
        content: [
            {
                type: "text",
                text: text,
            },
        ],
        isError: isError,
    }

}
