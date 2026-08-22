import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { PowershellClient } from "@/tools/powershell/client.js";
import { quotePowerShellString } from "@/tools/powershell/command-builder.js";
import {
    findErrorRecord,
    formatPowershellError,
    wantsFullErrors,
} from "@/tools/powershell/error-shaping.js";

// The results of usage of this tool are not quite good.
// Problems:
// 1. Huge amount of data to return
// 2. Different filter values
// 3. Find-Item command, which is wrapper around Sitecore Content Search API doesn't not return total count of items found.
// 4. AI agents are bad at proceeding long lists. E.g. search returns 100 items, AI agent parses only the first 24 and ignores the rest.

// The "rails" with strictly defined fields and filters helps to impove the tool.
// But results are still not good enough.
// Leaving this tool as is for now, it require more research and improvements in the future.

const filterValues = [
    "Equals",
    "StartsWith",
    "Contains",
    "ContainsAny",
    "ContainsAll",
    "EndsWith",
    "DescendantOf",
    "Fuzzy",
    "InclusiveRange",
    "ExclusiveRange",
    "MatchesRegex",
    "MatchesWildcard",
    "LessThan",
    "GreaterThan"
];

// `field` used to be a z.enum built at startup from every field name in the Solr index,
// fetched over PowerShell when the server booted. On a real project that enum ran to
// thousands of entries and loading this one schema cost roughly 15,000 tokens on every
// turn, whether the tool was called or not, and it grew with the index. The naming
// convention below is what an agent actually needs; an agent that needs the exhaustive
// list can ask for it with run-powershell-script, and every other agent no longer pays
// for it.
const FIELD_DESCRIPTION =
    "Index field name as it appears on the SearchResultItem. Sitecore's built-in fields "
    + "have no suffix: _name, _displayname, _fullpath, _path, _template, _templatename, "
    + "_templates, _language, _latestversion, _group, _uniqueid, _parent, _datasource, "
    + "_content, _database, _indexname, _creator, _isclone, _haslayout_b. Content fields "
    + "are lower-cased, spaces replaced with underscores, and carry a Solr dynamic-field "
    + "type suffix: _t (text), _s (string), _sm (multi-value string), _b (boolean), "
    + "_tl (long), _tf (float), _tdt / _dt (datetime) — for example 'title_t'. Versioned "
    + "fields additionally carry the language, e.g. 'title_t_en'. To list the exact fields "
    + "in an index, call run-powershell-script with a Solr schema query against that index.";

const iso8601DateRegex = /^([\+-]?\d{4}(?!\d{2}\b))((-?)((0[1-9]|1[0-2])(\3([12]\d|0[1-9]|3[01]))?|W([0-4]\d|5[0-2])(-?[1-7])?|(00[1-9]|0[1-9]\d|[12]\d{2}|3([0-5]\d|6[1-6])))([T\s]((([01]\d|2[0-3])((:?)[0-5]\d)?|24\:?00)([\.,]\d+(?!:))?)?(\17[0-5]\d([\.,]\d+)?)?([zZ]|([\+-])([01]\d|2[0-3]):?([0-5]\d)?)?)?)?$/;

export async function findItemPowerShellTool(server: McpServer, config: Config) {
    const client = new PowershellClient(
        config.powershell.serverUrl,
        config.powershell.username,
        config.powershell.password,
        config.powershell.domain
    );

    //https://doc.sitecorepowershell.com/appendix/indexing/find-item
    server.registerTool(
        "indexing-find-item",
        {
            description: "Finds items using the Sitecore Content Search API. Date format should be in ISO 8601 format (e.g., '2023-10-01T00:00:00Z').",
            inputSchema: z.object({
                index: z.string().optional()
                    .default("sitecore_master_index").describe("The name of the Sitecore index to search in. e.g., 'sitecore_master_index', 'sitecore_web_index'."),
                //array of objects
                criteria: z.array(
                    z.object({
                        filter: z.enum(filterValues).describe("The type of filter to apply to the search criteria."),
                        field: z.string().describe(FIELD_DESCRIPTION),
                        value: z.string().describe("The value to search for."),

                    })
                    // An empty array reaches Find-Item as `-Criteria @()`, which is not a
                    // search for everything: it is a call the cmdlet cannot interpret.
                ).min(1, "Supply at least one search criterion."),
                first: z.number().int().positive().optional().default(200).describe("The maximum number of results to return. Defaults to 200."),
                skip: z.number().int().nonnegative().optional().default(0).describe("The number of results to skip. Defaults to 0."),
            }),
        },
        async (params) => {

            const criteria = params?.criteria?.map((c: any) => {
                // Depending on the field type and filter type, the criteria format may vary.
                // Implemented only for DateTime fields and some common filters.
                // Other fields should be implmented as needed.
                if (c.field.endsWith("_dt")
                    || c.field.endsWith("_tdt")) {
                    if (c.filter === "InclusiveRange"
                        || c.filter === "ExclusiveRange") {
                        let divider = "";
                        if (c.value.indexOf("|") > -1) {
                            divider = "|";
                        }
                        else {
                            throw new Error(`Invalid date range format for field ${c.field}. Expected format is 'start_date | end_date'.`);
                        }
                        const [startDate, endDate] = c.value.split(divider).map((date: string) => date.trim());
                        if (!startDate || !endDate) {
                            throw new Error(`Invalid date range format for field ${c.field}. Expected format is 'start_date | end_date'.`);
                        }
                        if (!iso8601DateRegex.test(startDate) || !iso8601DateRegex.test(endDate)) {
                            throw new Error(`Invalid date format for field ${c.field}. Expected format is ISO 8601 (e.g., '2023-10-01T00:00:00Z'). 'start_date | end_date'`);
                        }
                        return `@{ Filter = "${c.filter}"; Field = ${quotePowerShellString(c.field)}; Value = [datetime[]]@([datetime]"${startDate}", [datetime]"${endDate}"); }`;
                    }
                    if (!iso8601DateRegex.test(c.value)) {
                        throw new Error(`Invalid date format for field ${c.field}. Expected format is ISO 8601 (e.g., '2023-10-01T00:00:00Z').`);
                    }
                    return `@{ Filter = "${c.filter}"; Field = ${quotePowerShellString(c.field)}; Value = [datetime]"${c.value}"; }`;
                }

                return `@{ Filter = "${c.filter}"; Field = ${quotePowerShellString(c.field)}; Value = ${quotePowerShellString(c.value)}; }`;
            }).join(", ");

            let extraFields = "";
            params.criteria.forEach((c: any) => {
                extraFields += `, @{n=${quotePowerShellString(c.field)}; e={$_.Fields[${quotePowerShellString(c.field)}]}}`;
            });

            const command = `Find-Item -Index ${quotePowerShellString(params.index)} -Criteria @(${criteria}) -First ${params.first} -Skip ${params.skip} | Select-Object  @{n="Name"; e={$_.Name}}, @{n="Path"; e={$_.Path}},@{n="ItemId"; e={$_.ItemId.ToString()}}, @{n="TemplateId"; e={$_.TemplateId.ToString()}}, @{n="TemplateName"; e={$_.TemplateName}} ${extraFields}`;

            return safeMcpResponse((async () => {
                const result = await client.executeScriptJson(command, {});

                let parsed: any;
                try {
                    parsed = JSON.parse(result);
                } catch (error) {
                    return {
                        isError: true,
                        content: [{
                            type: "text" as const,
                            text:
                                `The Sitecore PowerShell service did not return JSON for the search `
                                + `(${error instanceof Error ? error.message : String(error)}). The `
                                + `response began: ${result.slice(0, 500)}`,
                        }],
                    };
                }

                // Find-Item failures used to be returned as a successful result carrying the
                // full serialized .NET ErrorRecord — 17,000-odd characters, and isError
                // unset, so the agent read a failed search as an empty one. Shape it the
                // same way every other PowerShell tool does.
                const errorRecord = findErrorRecord(parsed);
                if (errorRecord) {
                    return {
                        isError: true,
                        content: [{
                            type: "text" as const,
                            text: wantsFullErrors(undefined)
                                ? result
                                : formatPowershellError(errorRecord),
                        }],
                    };
                }

                return {
                    content: [{
                        type: "text" as const,
                        text: result === "{}" ? "No items found." : JSON.stringify(parsed.Obj, null, 2)
                    }]
                };
            })());

        }
    );
}
