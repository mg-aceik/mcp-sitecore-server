import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { runGenericPowershellCommand } from "../../simple/generic.js";
import { filterByLogLevel, LogLevel } from "./utils.js";

const logFilePrefixes =
    [
        "log",
        "Crawiling.log",
        "Search.log",
        "SPE.log",
        "Client.log",
        "OWin.log",
        "Publising.log",
    ];

/**
 * Sitecore names its log files with the CM's own local date, and this process may not
 * share that timezone. Formatting in UTC makes the value predictable and documented
 * rather than silently dependent on where the MCP server happens to run; a caller in a
 * different zone to the CM passes an explicit `date`.
 *
 * An unparseable `date` is rejected instead of yielding "NaNNaNNaN", which used to produce
 * a glob that matched nothing and reported it as "no logs". It is returned rather than
 * thrown for the reason `target-input.ts` gives: `safeMcpResponse` would prefix a thrown
 * error with "Error executing tool:", which reads as a server fault rather than as a call
 * the agent can correct.
 */
function formatDate(date: string | undefined): string | undefined {
    if (date === undefined) {
        return new Date().toISOString().slice(0, 10).replace(/-/g, "");
    }

    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) {
        return undefined;
    }
    return parsed.toISOString().slice(0, 10).replace(/-/g, "");
}

export function getLogsPowerShellTool(server: McpServer, config: Config) {
    server.registerTool(
        `logging-get-logs`,
        {
            description: `Retrieves Sitecore logs from the log directory.`,
            inputSchema: z.object({
                name: z.string()
                    // Restrict to a safe filename charset: this value is interpolated into a
                    // PowerShell path glob (alongside the $SitecoreDataFolder variable), so it
                    // cannot be single-quoted. Disallowing shell metacharacters prevents injection.
                    .regex(/^[A-Za-z0-9._*-]*$/, "name may only contain letters, digits, '.', '_', '-' and '*'")
                    .optional()
                    .default("log")
                    .describe(`The name of the log file to retrieve. If not provided, defaults to log.*. Possible options: ${logFilePrefixes.join(", ")}.`),
                level: z.enum(Object.values(LogLevel))
                    .optional()
                    .default(LogLevel.DEBUG)
                    .describe("The level of the log to retrieve. Defaults to DEBUG."),
                date: z.string()
                    .optional()
                    .describe(`The date of the log file to retrieve. If not provided, defaults to today. Date format should be in ISO 8601 format (e.g., '2023-10-01T00:00:00Z'`),
                tail: z.number().int().positive()
                    .optional()
                    .default(500)
                    .describe("The number of lines to retrieve from the end of the log file. Defaults to 500."),
            }),
        },
        async (params) => {
            const stringDate = formatDate(params.date);
            if (stringDate === undefined) {
                return {
                    isError: true,
                    content: [{
                        type: "text" as const,
                        text:
                            `'date' is not a date this server can read: '${params.date}'. Use `
                            + `ISO 8601, e.g. '2023-10-01T00:00:00Z'.`,
                    }],
                };
            }

            return safeMcpResponse((async () => {
                const command = `Get-ChildItem -Path $SitecoreDataFolder/logs/${params.name}*${stringDate}*.* | Sort LastWriteTime | Get-Content -Tail ${params.tail} `;

                const json = await runGenericPowershellCommand(config, command, {});
                const raw = (json.content[0] as any)?.text as string;

                // On failure `raw` is the shaped error message, not JSON. Parsing it anyway
                // threw a SyntaxError that replaced a message built to be actionable with
                // "Error executing tool: Unexpected token".
                if (json.isError) {
                    return json;
                }

                const filteredLogs = filterByLogLevel(JSON.parse(raw) as any, LogLevel[params.level as keyof typeof LogLevel] || LogLevel.DEBUG);

                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(filteredLogs, null, 2),
                        },
                    ],
                    isError: false,
                };
            })());
        }
    );
}