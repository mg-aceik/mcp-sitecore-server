import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { safeMcpResponse } from "@/helper.js";
import { requireOneTarget } from "@/tools/target-input.js";
import { fetchWithTimeout } from "@/utils.js";
import { assertFetchableSourceUrl, resolveLocalMediaPath } from "@/tools/powershell/media/local-files.js";
import { mediaTimeoutMs } from "@/tools/powershell/media/media-service.js";
import { executeAuthoringGraphQL, getAuthoringToken } from "../client.js";
import { runAuthoringOperation } from "../logic/run.js";

/**
 * Media upload over the Authoring and Management API.
 *
 * `uploadMedia` does not take the bytes: it returns a pre-signed URL that the file is then
 * POSTed to as multipart form data with the same bearer token. Both halves happen inside
 * this one tool, because a tool that handed an agent a URL and left it there would be
 * asking the model to make an HTTP request it has no way to make.
 *
 * This is the supported counterpart to `media-upload`, which goes through the SPE
 * mediaUpload handler. Prefer this one where the Authoring API is available: it needs no
 * SPE Remoting, and it is the path Sitecore documents.
 */

/** The bytes to upload, and the name they should be stored under. */
type MediaSource = { bytes: Buffer; fileName: string };

async function resolveSource(params: {
    sourceUrl?: string;
    filePath?: string;
    content?: string;
    itemPath: string;
}): Promise<MediaSource> {
    if (params.sourceUrl) {
        const url = await assertFetchableSourceUrl(params.sourceUrl);
        const response = await fetchWithTimeout(url.toString(), {}, mediaTimeoutMs());
        if (!response.ok) {
            throw new Error(
                `Fetching sourceUrl failed: ${response.status} ${response.statusText}`
            );
        }
        return {
            bytes: Buffer.from(await response.arrayBuffer()),
            // The extension is what Sitecore uses to pick the media type, so it has to come
            // from a real file name. The URL's last segment is the only one on offer.
            fileName: path.posix.basename(url.pathname) || path.posix.basename(params.itemPath),
        };
    }

    if (params.filePath) {
        const resolved = resolveLocalMediaPath(params.filePath, "filePath");
        return { bytes: await readFile(resolved), fileName: path.basename(resolved) };
    }

    return {
        bytes: Buffer.from(params.content!, "base64"),
        fileName: path.posix.basename(params.itemPath),
    };
}

export function authoringUploadMediaTool(server: McpServer, config: Config) {
    server.registerTool(
        "authoring-upload-media",
        {
            description:
                "Uploads a file into the Sitecore media library over the Authoring and Management "
                + "API and returns the created media item. Does both halves of the documented flow: "
                + "asks uploadMedia for a pre-signed URL, then POSTs the bytes to it. Source is "
                + "exactly one of sourceUrl (fetched by this server — use this to import from a live "
                + "site), filePath (local to the machine running this MCP server), or content "
                + "(base64). Needs no SPE Remoting, unlike media-upload.",
            // Inferred annotations would read "upload" as a non-destructive write, but
            // overwriteExisting replaces the blob on an existing item, and sourceUrl makes
            // this server fetch an arbitrary host.
            annotations: {
                title: "Authoring Upload Media",
                readOnlyHint: false,
                destructiveHint: true,
                openWorldHint: true,
            },
            inputSchema: z.object({
                itemPath: z.string()
                    .describe("Where the item goes, relative to the media library and WITHOUT the '/sitecore/media library/' prefix — e.g. 'Project/MySite/hero'. The last segment is the item's name and must NOT carry a file extension: 'hero', not 'hero.png'. The extension comes from fileName (or the source), and Sitecore reads it to pick the media type — so a '.png' source becomes an Image item with an Alt field, while a '.txt' one becomes a File item that has no Alt."),
                sourceUrl: z.string().optional()
                    .describe("http(s) URL to fetch the bytes from. Supply this, filePath or content."),
                filePath: z.string().optional()
                    .describe("Path to a file on the machine running this MCP server. Refused over the HTTP transport unless MEDIA_LOCAL_FILE_ROOT names a directory to confine it to. Supply this, sourceUrl or content."),
                content: z.string().optional()
                    .describe("The file bytes as base64. Small files only — prefer sourceUrl or filePath for anything sizable. Supply this, sourceUrl or filePath."),
                fileName: z.string().optional()
                    .describe("The file name to upload as, including its extension. Defaults to the name from filePath or sourceUrl. Sitecore reads the extension to decide the media type, so set this when the source has none."),
                alt: z.string().optional().describe("Alt text for the media item."),
                language: z.string().optional().describe("The language of the media item."),
                database: z.string().optional().describe("The database holding the media library. Defaults to master."),
                overwriteExisting: z.boolean().optional()
                    .describe("When true, replace the file on an existing item at itemPath instead of failing."),
                versioned: z.boolean().optional()
                    .describe("When true, create the media item as versioned rather than shared."),
                includeExtensionInItemName: z.boolean().optional()
                    .describe("When true, keep the file extension in the item's name."),
            }),
        },
        (params) => {
            return safeMcpResponse((async () => {
                const invalid = requireOneTarget(params, ["sourceUrl", "filePath", "content"]);
                if (invalid) {
                    return invalid;
                }

                const source = await resolveSource(params);
                if (source.bytes.length === 0) {
                    throw new Error(
                        "The source produced 0 bytes; refusing to create an empty media item."
                    );
                }
                const fileName = params.fileName ?? source.fileName;

                const presignQuery = `
                    mutation UploadMedia($input: UploadMediaInput!) {
                      uploadMedia(input: $input) { presignedUploadUrl }
                    }`;

                const presigned = await executeAuthoringGraphQL(config, presignQuery, {
                    input: {
                        itemPath: params.itemPath,
                        alt: params.alt,
                        language: params.language,
                        database: params.database,
                        overwriteExisting: params.overwriteExisting,
                        versioned: params.versioned,
                        includeExtensionInItemName: params.includeExtensionInItemName,
                    },
                }) as { uploadMedia?: { presignedUploadUrl?: string } };

                const uploadUrl = presigned?.uploadMedia?.presignedUploadUrl;
                if (!uploadUrl) {
                    throw new Error(
                        "uploadMedia returned no presignedUploadUrl. If the endpoint reported "
                        + "'The specified key is not a valid size for this algorithm', the CM's "
                        + "GraphQL.UploadMediaOptions.EncryptionKey setting has no value and must be set."
                    );
                }

                // The pre-signed URL still requires the bearer token: the token in its query
                // string authorizes the *upload slot*, not the caller.
                const form = new FormData();
                form.append(
                    "file",
                    new Blob([new Uint8Array(source.bytes)], { type: "application/octet-stream" }),
                    fileName
                );

                const upload = await fetchWithTimeout(uploadUrl, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${await getAuthoringToken(config)}` },
                    body: form,
                }, mediaTimeoutMs());

                const text = await upload.text();
                if (!upload.ok) {
                    throw new Error(
                        `The pre-signed upload returned ${upload.status} ${upload.statusText}. `
                        + `Response: ${text.slice(0, 1000)}`
                    );
                }

                // The upload answers with the created item's ID, name and full path.
                let created: unknown;
                try {
                    created = JSON.parse(text);
                } catch {
                    created = text;
                }

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            uploaded: created,
                            uploadedBytes: source.bytes.length,
                            fileName,
                        }, null, 2),
                    }],
                    isError: false,
                };
            })());
        }
    );
}

export function authoringGetMediaItemTool(server: McpServer, config: Config) {
    server.registerTool(
        "authoring-get-media-item",
        {
            description:
                "Reads a media item over the Authoring and Management API, returning its identity, "
                + "mime type, size and URL. Use it after authoring-upload-media to get the ID an "
                + "image field value needs, or to check what is already in the media library. Supply "
                + "exactly one of id or path.",
            inputSchema: z.object({
                id: z.string().optional().describe("The media item's GUID. Supply this or path."),
                path: z.string().optional()
                    .describe("The media item's full path, e.g. '/sitecore/media library/Project/MySite/hero'. Supply this or id."),
                language: z.string().optional().describe("The media item's language."),
                database: z.string().optional().describe("The database holding the media library. Defaults to master."),
            }),
        },
        (params) => {
            const invalid = requireOneTarget(params, ["id", "path"]);
            if (invalid) {
                return Promise.resolve(invalid);
            }

            // MediaItem carries only the media facts; identity lives on innerItem.
            const query = `
                query GetMediaItem($where: MediaItemQueryInput!) {
                  mediaItem(where: $where) {
                    extension
                    mimeType
                    size
                    alt
                    title
                    description
                    mediaPath
                    url
                    innerItem {
                      itemId
                      name
                      path
                      database
                      language { name }
                      version
                      template { templateId name }
                    }
                  }
                }`;

            return safeMcpResponse(runAuthoringOperation(config, query, {
                where: {
                    mediaItemId: params.id,
                    path: params.path,
                    language: params.language,
                    database: params.database,
                },
            }));
        }
    );
}
