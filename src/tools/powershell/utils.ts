import { quotePowerShellString } from "./command-builder.js";

export function prepareArgsString(parameters: Record<string, any>): string {
    let scriptWithParameters = "";
    if (parameters) {
        for (const parameter in parameters) {
            if (parameters[parameter] === "") {
                scriptWithParameters += ` -${parameter}`;
            }
            else if (Array.isArray(parameters[parameter])) {
                const items = parameters[parameter]
                    .map((item: unknown) => quotePowerShellString(item))
                    .join(",");
                scriptWithParameters += ` -${parameter} ${items}`;
            } else {
                scriptWithParameters += ` -${parameter} ${quotePowerShellString(parameters[parameter])}`;
            }
        }
    }

    return scriptWithParameters;
}

export function getSwitchParameterValue(value: boolean | undefined): string | undefined 
{
    if (value === true)
    {
        return "";
    }

    return undefined;
}

/**
 * The rendering-instance tools (get/set/switch/remove-rendering and the
 * rendering-parameter tools) default `finalLayout` to true, matching
 * `presentation-list-renderings`: the final layout is the effective presentation, and a
 * uniqueId the caller just read from a listing exists there. Before this default the
 * tools read the shared layout, so an id straight out of `list-renderings` produced
 * "no matching rendering" for any instance that lives only in the final layout.
 */
// Spread into 7 tools, so this is paid 7 times on every turn. The reasoning above is the
// place for it; the wire format gets the one fact a caller acts on.
export const EFFECTIVE_FINAL_LAYOUT_DESCRIPTION =
    "Target the final layout (default true), where list-renderings' uniqueIds live. False = shared only.";

/** The `-FinalLayout` switch value for the tools that default to the final layout. */
export function getFinalLayoutSwitchValue(finalLayout: boolean | undefined): string | undefined {
    return getSwitchParameterValue(finalLayout !== false);
}

export function getNumberParameterValue(value: number | undefined): number | undefined
{
    if (value || value === 0)
    {
        return value;
    }

    return undefined;
}


/**
 * The `database` parameter, described once.
 *
 * Three wordings of this same sentence were spread across 35 tools; at 67-133 characters
 * each that was roughly 2,600 characters of every `tools/list`, paid on every turn, to say
 * the same thing three ways. A path carries its own `master:` prefix, so `database` only
 * ever matters when addressing by id -- which is the one fact worth spending characters on.
 */
export const ITEM_DATABASE_DESCRIPTION =
    "Database to resolve an id against (default master).";
