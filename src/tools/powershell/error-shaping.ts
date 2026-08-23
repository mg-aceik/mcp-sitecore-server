/**
 * Error shaping for PowerShell responses.
 *
 * SPE returns a failed command as a serialized `ErrorRecord`, and the CLIXML→JSON
 * conversion expands all of it: `Exception` (with `ToString` carrying the full .NET
 * stack trace), `InvocationInfo`, `MyCommand` (with the cmdlet `Definition` and every
 * `ParameterMetadata` key), `StackTrace`, `InnerException`, and a nested duplicate of
 * most of it. One wrong parameter name measured 17,567 characters against a live CM.
 * The agent needed one line: `Cannot bind parameter 'Rendering'`.
 *
 * Transport note — see `composite/presentation/rendering-guard.ts` for the full
 * rationale. Over the SPE remoting transport a `throw` becomes an HTTP 500 whose body
 * (our message included) the client discards, whereas `Write-Error` comes back as a
 * normal 200 carrying an `ErrorRecord`. That is why the guards use `Write-Error`, and
 * it is why this module is the only place the agent's error text is decided: every
 * failure that reaches the agent at all arrives here as a serialized `ErrorRecord`.
 */

/** `FullyQualifiedErrorId` values PowerShell uses for parameter binding failures. */
const PARAMETER_BINDING_ERROR_IDS =
    /NamedParameterNotFound|CannotConvertArgument|AmbiguousParameterSet|MissingMandatoryParameter|ParameterArgumentValidation|ParameterArgumentTransformation|CannotBind|ParameterSetNotFound|NamedParameterAmbiguous|PositionalParameterNotFound/i;

/**
 * The CLIXML parser leaves encoded control characters in place. Turn them back into
 * real line breaks (and drop lone carriage returns) so a message reads as one line.
 */
export function decodeClixmlWhitespace(value: string): string {
    return value
        .replaceAll("_x000D__x000A_", "\n")
        .replaceAll("_x000A_", "\n")
        .replaceAll("_x000D_", "")
        .replaceAll("_x0009_", "\t");
}

function asArray(value: unknown): any[] {
    if (Array.isArray(value)) {
        return value;
    }
    return value === undefined || value === null ? [] : [value];
}

function firstString(...candidates: unknown[]): string | undefined {
    for (const candidate of candidates) {
        if (typeof candidate === "string" && candidate.trim() !== "") {
            return candidate;
        }
    }
    return undefined;
}

/**
 * Finds the serialized `ErrorRecord` in a converted PowerShell response, if there is one.
 *
 * The previous check only looked at `Obj[0]`, which missed a script that emitted output
 * before it failed. `writeErrorStream` is included because SPE sets it on anything that
 * arrived on the error stream (which is how `Write-Error` guards surface).
 */
export function findErrorRecord(json: any): any | undefined {
    return asArray(json?.Obj).find(
        (entry) =>
            entry
            && typeof entry === "object"
            && !Array.isArray(entry)
            && (entry.ErrorCategory_Message !== undefined || entry.writeErrorStream === true)
    );
}

/**
 * True when the failure is a parameter binding error — the case where knowing the
 * cmdlet's valid parameter sets is what the agent needs in order to re-call correctly.
 */
export function isParameterBindingError(record: any): boolean {
    const reason = String(record?.ErrorCategory_Reason ?? "");
    const errorId = String(record?.FullyQualifiedErrorId ?? "");
    return reason.includes("ParameterBinding") || PARAMETER_BINDING_ERROR_IDS.test(errorId);
}

function parameterSets(record: any): string[] {
    const sets = record?.InvocationInfo?.MyCommand?.ParameterSets;
    return asArray(Array.isArray(sets) ? sets : typeof sets === "object" && sets ? Object.values(sets) : sets)
        .filter((set): set is string => typeof set === "string" && set.trim() !== "")
        // `[<CommonParameters>]` is on every set of every cmdlet and tells the agent nothing.
        .map((set) => decodeClixmlWhitespace(set).replace(/\s*\[<CommonParameters>\]\s*/g, "").trim())
        .filter((set) => set !== "");
}

/**
 * Reduces a serialized `ErrorRecord` to what the agent's next action needs: the message,
 * the error id, where it happened, and — for a parameter binding failure — the cmdlet's
 * valid parameter sets.
 *
 * The full record stays reachable behind a tool's `full: true` parameter, or globally via
 * `POWERSHELL_FULL_ERRORS=true`.
 */
export function formatPowershellError(record: any): string {
    const command = firstString(record?.InvocationInfo?.MyCommand?.Name);
    const message = decodeClixmlWhitespace(
        firstString(record?.Exception?.Message, record?.ErrorCategory_Message, record?.ToString)
        ?? "PowerShell reported an error with no message."
    ).trim();

    const lines: string[] = [command ? `${command} failed: ${message}` : `PowerShell error: ${message}`];

    const errorId = firstString(record?.FullyQualifiedErrorId);
    if (errorId) {
        lines.push(`FullyQualifiedErrorId: ${errorId}`);
    }

    const lineNumber = record?.InvocationInfo?.ScriptLineNumber;
    const offsetInLine = record?.InvocationInfo?.OffsetInLine;
    if (typeof lineNumber === "number") {
        lines.push(`At line ${lineNumber}, char ${offsetInLine ?? 0}.`);
    }

    if (isParameterBindingError(record)) {
        const sets = parameterSets(record);
        if (sets.length > 0) {
            lines.push(`Valid parameter sets${command ? ` for ${command}` : ""}:`);
            lines.push(...sets.map((set) => `  ${set}`));
        }
    }

    lines.push("Pass full=true for the complete .NET error record.");

    return lines.join("\n");
}

/**
 * Whether the untruncated error record was requested. `full` is the per-call tool
 * parameter; the env var is the global escape hatch for a tool that has no `full`.
 */
export function wantsFullErrors(full: boolean | undefined, env: NodeJS.ProcessEnv = process.env): boolean {
    if (full) {
        return true;
    }
    return String(env.POWERSHELL_FULL_ERRORS ?? "").toLowerCase() === "true";
}

/**
 * Detects a failure in a raw CLIXML response, where there is no parsed object to inspect.
 *
 * The previous check was `text.includes("Error")`, which flagged any successful response
 * whose content merely contained the word — a Sitecore site's own "Error 404" page item
 * was enough to report a tool failure. Match the CLIXML shapes an error actually takes:
 * a string on the error stream, or a serialized `ErrorRecord`'s own properties.
 */
export function xmlLooksLikeError(text: string): boolean {
    return /\sS="[Ee]rror"/.test(text)
        || /N="ErrorCategory_Message"/.test(text)
        // Match the *value*, not the property name: SPE serializes the flag on non-error
        // output too, so `N="writeErrorStream"` alone reported every such response as a
        // failure.
        || /N="writeErrorStream"\s*>\s*true\s*</i.test(text);
}
