import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "@/config.js";
import { safeMcpResponse } from "@/helper.js";
import { runGenericPowershellCommand } from "../generic.js";
import { itemProjectionInputSchema, itemProjectionPipeline } from "../../projection.js";

export function getDefaultLayoutDevicePowershellTool(server: McpServer, config: Config) {
    server.registerTool(
        "presentation-get-default-layout-device",
        {
            description: "Gets the default layout.",
            inputSchema: {
                ...itemProjectionInputSchema,
            },
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
