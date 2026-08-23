import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { writeFile } from "node:fs/promises";
import { safeMcpResponse } from "@/helper.js";
import { mediaFetch, mediaServiceUrl, toMediaLibraryRelativePath } from "./media-service.js";
import { resolveLocalMediaPath } from "./local-files.js";

/**
 * Downloads a media item's blob through the SPE mediaDownload handler — the same wire
 * protocol as SPE Remoting's `Receive-RemoteItem -Database`: GET
 * `/-/script/media/<database>/<path>/` returns the raw bytes.
 *
 * Blobs are large and base64 is a third larger again, so the default response is capped:
 * anything bigger must go to disk via `saveTo` (a path local to the machine running this
 * MCP server), which returns metadata instead of content.
 */
const DEFAULT_MAX_BASE64_BYTES = 512_000;

export function mediaDownloadTool(server: McpServer, config: Config) {
    server.registerTool(
        "media-download",
        {
            description:
                "Downloads a media item's blob from the Sitecore media library via the SPE "
                + "mediaDownload service. Pass saveTo to write it to a file local to the machine "
                + "running this MCP server (always do this for anything over ~0.5MB); without "
                + "saveTo the blob is returned inline as base64, capped at maxBytes. Requires "
                + "<mediaDownload enabled=\"true\"> in the CM's SPE services config.",
            // Read-only against Sitecore, but saveTo writes a file on the machine running
            // this server, so the inferred readOnlyHint would be a false promise.
            annotations: {
                title: "Media Download",
                readOnlyHint: false,
                destructiveHint: false,
            },
            inputSchema: z.object({
                path: z.string()
                    .describe("The media item path WITHOUT file extension (e.g. 'Project/Stride/Corporate/Migrated/team-photo' — the '/sitecore/media library/' prefix is optional), or the media item's GUID."),
                database: z.string().optional().default("master")
                    .describe("The database holding the media library. Defaults to master."),
                saveTo: z.string().optional()
                    .describe("File path on the machine running this MCP server to write the blob to. When set, the response carries metadata only — no base64. Refused over the HTTP transport unless MEDIA_LOCAL_FILE_ROOT names a directory to confine it to."),
                maxBytes: z.number().int().positive().optional()
                    .describe(`Inline-response size cap in bytes (default ${DEFAULT_MAX_BASE64_BYTES}). A blob over the cap errors with its actual size — pass saveTo instead of raising the cap unless you truly need the bytes inline.`),
            }),
        },
        async (params) => {
            return safeMcpResponse((async () => {
                const path = toMediaLibraryRelativePath(params.path);
                const response = await mediaFetch(config, mediaServiceUrl(config, params.database, path), {
                    method: "GET",
                });
                const bytes = Buffer.from(await response.arrayBuffer());
                if (bytes.length === 0) {
                    throw new Error(
                        `The media service returned 0 bytes for '${params.path}'. Verify the item exists, `
                        + `the path carries no file extension, and the database is right.`
                    );
                }

                const contentType = response.headers.get("content-type") ?? "";
                const result: Record<string, unknown> = {
                    Path: params.path,
                    Database: params.database,
                    Size: bytes.length,
                    ContentType: contentType,
                };

                if (params.saveTo) {
                    const destination = resolveLocalMediaPath(params.saveTo, "saveTo");
                    await writeFile(destination, bytes);
                    result.SavedTo = destination;
                } else {
                    const cap = params.maxBytes ?? DEFAULT_MAX_BASE64_BYTES;
                    if (bytes.length > cap) {
                        throw new Error(
                            `The blob is ${bytes.length} bytes, over the ${cap}-byte inline cap. `
                            + `Pass saveTo to write it to a local file instead.`
                        );
                    }
                    result.ContentBase64 = bytes.toString("base64");
                }

                return {
                    content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
                    isError: false,
                };
            })());
        }
    );
}
