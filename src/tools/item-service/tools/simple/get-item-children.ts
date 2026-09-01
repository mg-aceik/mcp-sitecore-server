import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { getItemChildren } from "../../logic/simple/get-item-children.js";
import { safeMcpResponse } from "@/helper.js";

export function getItemChildrenTool(server: McpServer, config: Config) {
    server.registerTool(
        'item-service-get-item-children',
        {
            description:
                "Get the direct children of a Sitecore item by its ID, with all their fields. Pass "
                + "options.fields to return only the fields you need — the full form is roughly 1.9KB "
                + "per child.",
            inputSchema: z.object({
                id: z.string(),
                options: z.object({
                    database: z.string().optional(),
                    language: z.string().optional(),
                    version: z.string().optional(),
                    includeStandardTemplateFields: z.boolean().optional(),
                    includeMetadata: z.boolean().optional(),
                    fields: z.array(z.string()).optional()
                        .describe("Return only these fields on each item. Set it whenever you know what you need — a full item carries every field of its template, roughly 1.9KB each."),
                }).optional(),
            }),
        },
        async (params) => {
            return safeMcpResponse(getItemChildren(config, params.id, params.options || {}));
        }
    );
}
