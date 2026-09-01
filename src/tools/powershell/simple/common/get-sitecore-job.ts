import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { runGenericPowershellCommand } from "../generic.js";
import { JOB_PROJECTION, fixedProjectionPipeline, fullOnlyInputSchema } from "../../projection.js";

export function getSitecoreJobPowerShellTool(server: McpServer, config: Config) {
    server.registerTool(
        "common-get-sitecore-job",
        {
            description:
                "Gets the current Sitecore jobs with their state and progress. Get-SitecoreJob takes no "
                + "arguments, so every job is returned; read State and IsDone to find the one you want.",
            inputSchema: z.object({
                ...fullOnlyInputSchema,
            }),
        },
        async (params) => {
            const command = `Get-SitecoreJob`;

            // Unprojected this returned 42,018 characters: every job with its Options,
            // MessageQueue and WaitHandle expanded, and no parameter to ask for less.
            const pipeline = fixedProjectionPipeline(JOB_PROJECTION, params);

            return safeMcpResponse(
                runGenericPowershellCommand(config, command, {}, undefined, {
                    pipeline,
                    full: params.full,
                })
            );
        }
    );
}
