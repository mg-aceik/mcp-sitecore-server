import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { runGenericPowershellCommand } from "../generic.js";
import { itemProjectionInputSchema, itemProjectionPipeline } from "../../projection.js";

/**
 * `presentation-get-layout-device` and `presentation-get-default-layout-device` merged, with
 * the name optional.
 *
 * `Get-LayoutDevice` has exactly two parameter sets — `[-Name] <String>` and `[-Default]` —
 * so the two tools were one cmdlet call apart, differing only in which switch they sent.
 * Omitting `name` now asks for the default device, which is what the second tool did.
 */
export function getLayoutDevicePowershellTool(server: McpServer, config: Config) {
    server.registerTool(
        "presentation-get-layout-device",
        {
            description:
                "Gets a layout device by name, or the default device when name is omitted. On a "
                + "headless site there is usually only the Default device.",
            inputSchema: z.object({
                name: z.string().optional()
                    .describe("Name of the device to return, e.g. 'Default'. Omit for the default device."),
                ...itemProjectionInputSchema,
            }),
        },
        async (params) => {
            // `-Default` is a switch in its own parameter set, so it goes in the command
            // string rather than the options map.
            const command = params.name ? `Get-LayoutDevice` : `Get-LayoutDevice -Default`;
            const options: Record<string, any> = params.name ? { "Name": params.name } : {};

            return safeMcpResponse(runGenericPowershellCommand(config, command, options, undefined, {
                full: params.full,
                pipeline: itemProjectionPipeline(params),
            }));
        }
    );
}
