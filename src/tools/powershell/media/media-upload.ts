import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { readFile } from "node:fs/promises";
import { safeMcpResponse } from "@/helper.js";
import { requireOneTarget } from "@/tools/target-input.js";
import { fetchWithTimeout } from "@/utils.js";
import { runGenericPowershellCommand } from "../simple/generic.js";
import { quotePowerShellString } from "../command-builder.js";
import { mediaFetch, mediaServiceUrl, mediaTimeoutMs, toMediaLibraryRelativePath } from "./media-service.js";
import { assertFetchableSourceUrl, resolveLocalMediaPath } from "./local-files.js";

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
                + "returns the created media item (ID, path, size, mime type). Overwrites an existing "
                + "item at the destination unless skipExisting is set. Source is exactly one "
                + "of sourceUrl (fetched by this server — use this to import from a live site), "
                + "filePath (local to the machine running this MCP server), or content (base64). "
                + "Requires <mediaUpload enabled=\"true\"> in the CM's SPE services config.",
            // Inferred annotations would call this a non-destructive write, but the default
            // behaviour replaces the blob of whatever media item already sits at the
            // destination, and sourceUrl makes the server fetch an arbitrary host.
            annotations: {
                title: "Media Upload",
                readOnlyHint: false,
                destructiveHint: true,
                openWorldHint: true,
            },
            inputSchema: z.object({
                destination: z.string()
                    .describe("Media library path for the item, including the file name with extension (e.g. 'Project/Stride/Corporate/Migrated/team-photo.jpg' — the '/sitecore/media library/' prefix is optional), or the GUID of an existing media item to overwrite. The item is named after the file name up to its FIRST dot, with characters Sitecore will not accept in a name removed, so 'v1.2 asset.jpg' becomes an item called 'v1' — avoid dots in the name itself. The response reports the name the item actually got."),
                sourceUrl: z.string().optional()
                    .describe("http(s) URL to fetch the bytes from (e.g. an image on the site being migrated). Supply this, filePath or content."),
                filePath: z.string().optional()
                    .describe("Path to a file on the machine running this MCP server. Refused over the HTTP transport unless MEDIA_LOCAL_FILE_ROOT names a directory to confine it to. Supply this, sourceUrl or content."),
                content: z.string().optional()
                    .describe("The file bytes as base64. Suits small files only — prefer sourceUrl or filePath for anything sizable. Supply this, sourceUrl or filePath."),
                database: z.string()
                    .regex(/^[A-Za-z][A-Za-z0-9_-]*$/, "database must be a plain database name, e.g. 'master'")
                    .optional().default("master")
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
                    const url = await assertFetchableSourceUrl(params.sourceUrl);
                    const source = await fetchWithTimeout(url.toString(), {}, mediaTimeoutMs());
                    if (!source.ok) {
                        throw new Error(`Fetching sourceUrl failed: ${source.status} ${source.statusText}`);
                    }
                    bytes = Buffer.from(await source.arrayBuffer());
                } else if (params.filePath) {
                    bytes = await readFile(resolveLocalMediaPath(params.filePath, "filePath"));
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
                //
                // The item's name is not the file name: Sitecore runs the name through
                // ItemUtil.ProposeValidItemName, which rewrites characters it will not
                // accept, so reconstructing the path in TypeScript finds nothing for a
                // perfectly successful upload. The lookup below asks Sitecore for the same
                // transformation instead, and falls back to matching the media item's own
                // file name when even that misses.
                const isGuid = /^\{?[0-9a-fA-F-]{36}\}?$/.test(destination);
                const lookup = isGuid
                    ? `Get-Item -Path ($database + ':') -ID '{${destination.replace(/[{}]/g, "")}}' -ErrorAction SilentlyContinue`
                    : `Get-McpUploadedMediaItem -Database $database -Destination $destination`;

                const script = `
                    $database = ${quotePowerShellString(params.database)};
                    $destination = ${quotePowerShellString(destination)};

                    function Get-McpUploadedMediaItem {
                        param([string]$Database, [string]$Destination)

                        $lastSlash = $Destination.LastIndexOf('/');
                        $folder = '';
                        $leaf = $Destination;
                        if ($lastSlash -ge 0) {
                            $folder = $Destination.Substring(0, $lastSlash);
                            $leaf = $Destination.Substring($lastSlash + 1);
                        }

                        # The handler splits the leaf at its FIRST dot and treats the rest as
                        # the extension, so 'my.probe.png' is stored as an item named 'my'.
                        # Verified against a live CM. The last-dot reading is kept as a
                        # candidate rather than assumed, in case a version differs, and the
                        # whole leaf covers a destination with no dot at all.
                        $firstDot = $leaf.IndexOf('.');
                        $lastDot = $leaf.LastIndexOf('.');
                        $stems = New-Object System.Collections.ArrayList;
                        foreach ($stem in @(
                            $(if ($firstDot -gt 0) { $leaf.Substring(0, $firstDot) } else { $leaf }),
                            $(if ($lastDot -gt 0) { $leaf.Substring(0, $lastDot) } else { $leaf }),
                            $leaf
                        )) {
                            if ([string]::IsNullOrWhiteSpace($stem)) { continue }
                            # Sitecore rewrites characters it will not accept in an item name,
                            # so ask it for the transformation rather than reimplementing it.
                            foreach ($candidate in @([Sitecore.Data.Items.ItemUtil]::ProposeValidItemName($stem), $stem)) {
                                if (-not $stems.Contains($candidate)) { [void]$stems.Add($candidate) }
                            }
                        }

                        $parentPath = ($Database + ':/sitecore/media library' + $(if ($folder -eq '') { '' } else { '/' + $folder }));
                        $children = @(Get-ChildItem -Path $parentPath -ErrorAction SilentlyContinue);
                        if ($children.Count -eq 0) { return $null }

                        foreach ($candidate in $stems) {
                            $hit = $children |
                                Where-Object { $_.Name -eq $candidate } | Select-Object -First 1;
                            if ($null -ne $hit) { return $hit }
                        }
                        return $null;
                    }

                    $item = ${lookup};
                    if ($null -eq $item) { Write-Error "The upload returned success but no media item was found for '$destination'. The bytes were accepted by the CM; read the media library to locate the item."; return; }

                    # A destination whose leaf names an item that already exists and is not a
                    # media item -- most often a folder, because 'Project/MySite' resolves to
                    # the MySite folder itself -- used to be reported as a successful upload:
                    # the folder came back with UploadedBytes set, Size 0 and no error, while
                    # the bytes had gone nowhere. Verified live against a media folder. Check
                    # the resolved item actually carries the blob before claiming success, and
                    # do it *before* the Alt edit so a wrong item is never modified.
                    $probe = New-Object Sitecore.Data.Items.MediaItem $item;
                    if (${bytes.length} -gt 0 -and $probe.Size -eq 0) {
                        Write-Error "The destination '$destination' resolved to the existing item '$($item.Paths.Path)' (template '$($item.TemplateName)'), which holds no media blob, so the ${bytes.length} uploaded bytes were not stored. Include the file name with its extension in 'destination' -- 'Project/MySite/hero.png', not 'Project/MySite' -- or pass the GUID of the media item to overwrite.";
                        return;
                    }

                    ${params.alt !== undefined ? `$item.Editing.BeginEdit(); $item["Alt"] = ${quotePowerShellString(params.alt)}; [void]$item.Editing.EndEdit();` : ""}
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
