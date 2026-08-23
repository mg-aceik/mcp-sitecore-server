import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { runGenericPowershellCommand } from "../generic.js";
import { itemProjectionInputSchema, itemProjectionPipeline } from "../../projection.js";

export function getLayoutDevicePowershellTool(server: McpServer, config: Config) {
    server.registerTool(
        "presentation-get-layout-device",
        {
            description: "Gets the layout for the device specified.",
            inputSchema: z.object({
                ...itemProjectionInputSchema,
                name: z.string().describe("Name of the device to return."),
            }),
        },
        async (params) => {
            const command = `Get-LayoutDevice`;
            const options: Record<string, any> = {};

            options["Name"] = params.name;

            return safeMcpResponse(runGenericPowershellCommand(config, command, options, undefined, {
                full: params.full,
                pipeline: itemProjectionPipeline(params),
            }));
        }
    );
}