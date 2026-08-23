import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { runGenericPowershellCommand } from "../generic.js";

export function resumeSearchIndexPowerShellTool(server: McpServer, config: Config) {
    server.registerTool(
        "indexing-resume-search-index",
        {
            description: "Resume one or more Sitecore search indexes. If no name is provided, all paused indexes will be resumed.",
            inputSchema: z.object({
                name: z.string().optional().describe("The name of the index to resume. If not provided, all paused indexes will be resumed."),
            }),
        },
        async (params) => {
            const command = `Resume-SearchIndex`;
            const options: Record<string, any> = {};
            
            if (params.name) {
                options["Name"] = params.name;
            }

            return safeMcpResponse(runGenericPowershellCommand(config, command, options));
        }
    );
}
