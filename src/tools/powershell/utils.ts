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
export const EFFECTIVE_FINAL_LAYOUT_DESCRIPTION =
    "Which layout to target. Defaults to true (the final layout), which is the effective "
    + "presentation for the page and where the uniqueIds reported by "
    + "presentation-list-renderings live. Set false to target the shared layout only.";

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

