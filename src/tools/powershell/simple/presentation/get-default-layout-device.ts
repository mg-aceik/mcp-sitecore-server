import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { safeMcpResponse } from "@/helper.js";
import { runGenericPowershellCommand } from "../generic.js";
import { itemProjectionInputSchema, itemProjectionPipeline } from "../../projection.js";
import { z } from "zod";

export function getDefaultLayoutDevicePowershellTool(server: McpServer, config: Config) {
    server.registerTool(
        "presentation-get-default-layout-device",
        {
            description: "Gets the default layout.",
            inputSchema: z.object({
                ...itemProjectionInputSchema,
            }),
        },
        async (params) => {
            const command = `Get-LayoutDevice -Default`;

            return safeMcpResponse(runGenericPowershellCommand(config, command, {}, undefined, {
                full: params.full,
                pipeline: itemProjectionPipeline(params),
            }));
        }
    );
}
