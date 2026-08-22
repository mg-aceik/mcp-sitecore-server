import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { readFile } from "node:fs/promises";
import { safeMcpResponse } from "@/helper.js";
import { requireOneTarget } from "@/tools/target-input.js";
import { runGenericPowershellCommand } from "../simple/generic.js";
import { mediaFetch, mediaServiceUrl, toMediaLibraryRelativePath } from "./media-service.js";

/**
 * Uploads a media item through the SPE mediaUpload handler — the same wire protocol as
 * SPE Remoting's `Send-RemoteItem -RootPath Media`: POST the raw bytes to
 * `/-/script/media/<database>/<path.ext>/`. The bytes can come from a URL (the server
 * fetches them — the migration workhorse: nothing large ever passes through the model),
 * a file local to the machine running this MCP server, or inline base64.
 *
 * After the upload the created item is read back over remoting and returned, so the
 * caller gets the media item ID it needs for an `<image mediaid="..." />` field value —
 * and the optional `alt` is set in that same round trip.
 */
export function mediaUploadTool(server: McpServer, config: Config) {
    server.registerTool(
        "media-upload",
        {
            description:
                "Uploads a file into the Sitecore media library via the SPE mediaUpload service and "
                + "returns the created media item (ID, path, size, mime type). Source is exactly one "
                + "of sourceUrl (fetched by this server — use this to import from a live site), "
                + "filePath (local to the machine running this MCP server), or content (base64). "
                + "Requires <mediaUpload enabled=\"true\"> in the CM's SPE services config.",
            inputSchema: z.object({
                destination: z.string()
                    .describe("Media library path for the item, including the file name with extension (e.g. 'Project/Stride/Corporate/Migrated/team-photo.jpg' — the '/sitecore/media library/' prefix is optional), or the GUID of an existing media item to overwrite."),
                sourceUrl: z.string().optional()
                    .describe("URL to fetch the bytes from (e.g. an image on the site being migrated). Supply this, filePath or content."),
                filePath: z.string().optional()
                    .describe("Path to a file on the machine running this MCP server. Supply this, sourceUrl or content."),
                content: z.string().optional()
                    .describe("The file bytes as base64. Suits small files only — prefer sourceUrl or filePath for anything sizable. Supply this, sourceUrl or filePath."),
                database: z.string().optional().default("master")
                    .describe("The database holding the media library. Defaults to master."),
                alt: z.string().optional()
                    .describe("Alt text to set on the media item after upload."),
                skipExisting: z.boolean().optional()
                    .describe("When true, leave an existing item at the destination untouched instead of overwriting it."),
                skipUnpack: z.boolean().optional()
                    .describe("When true, store an uploaded .zip as a single media item instead of unpacking it."),
            }),
        },
        async (params) => {
            return safeMcpResponse((async () => {
                const invalid = requireOneTarget(params, ["sourceUrl", "filePath", "content"]);
                if (invalid) {
                    return invalid;
                }

                let bytes: Buffer;
                if (params.sourceUrl) {
                    const source = await fetch(params.sourceUrl);
                    if (!source.ok) {
                        throw new Error(`Fetching sourceUrl failed: ${source.status} ${source.statusText}`);
                    }
                    bytes = Buffer.from(await source.arrayBuffer());
                } else if (params.filePath) {
                    bytes = await readFile(params.filePath);
                } else {
                    bytes = Buffer.from(params.content!, "base64");
                }
                if (bytes.length === 0) {
                    throw new Error("The source produced 0 bytes; refusing to create an empty media item.");
                }

                const destination = toMediaLibraryRelativePath(params.destination);
                const query = [
                    params.skipExisting ? "skipexisting=true" : "",
                    params.skipUnpack ? "skipunpack=true" : "",
                ].filter(Boolean).join("&");

                await mediaFetch(config, mediaServiceUrl(config, params.database, destination, query), {
                    method: "POST",
                    body: new Uint8Array(bytes),
                });

                // Read the item back so the caller leaves with the ID (for image field
                // values) rather than a bare 200 — and set the alt text on the way.
                const isGuid = /^\{?[0-9a-f-]{36}\}?$/i.test(destination);
                const lookup = isGuid
                    ? `Get-Item -Path ($database + ':') -ID '{${destination.replace(/[{}]/g, "")}}'`
                    : `Get-Item -Path ($database + ':/sitecore/media library/' + $destination.Substring(0, $destination.LastIndexOf('.')))`;
                const script = `
                    $database = '${params.database}';
                    $destination = '${destination.replace(/'/g, "''")}';
                    $item = ${lookup};
                    if ($null -eq $item) { Write-Error "The upload returned success but no media item was found at '$destination'."; return; }
                    ${params.alt !== undefined ? `$item.Editing.BeginEdit(); $item["Alt"] = '${params.alt.replace(/'/g, "''")}'; $item.Editing.EndEdit() | Out-Null;` : ""}
                    $media = New-Object Sitecore.Data.Items.MediaItem $item;
                    [PSCustomObject]@{
                        ID = $item.ID.ToString();
                        Name = $item.Name;
                        Path = $item.Paths.Path;
                        Size = $media.Size;
                        MimeType = $media.MimeType;
                        Alt = $item["Alt"];
                        UploadedBytes = ${bytes.length};
                    }
                `;
                return runGenericPowershellCommand(config, script, {});
            })());
        }
    );
}
