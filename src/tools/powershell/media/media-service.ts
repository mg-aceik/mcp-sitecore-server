import type { Config } from "@/config.js";
import { fetchWithTimeout } from "@/utils.js";

/**
 * Shared plumbing for the SPE media handler (`/-/script/media/...`), the service behind
 * SPE Remoting's `Send-RemoteItem` / `Receive-RemoteItem`. It moves raw bytes with HTTP
 * Basic auth: upload is a POST with the file as the body, download is a GET returning
 * the blob. The handler must be enabled on the CM (`<mediaUpload enabled="true">` /
 * `<mediaDownload enabled="true">` under `<powershell><services>`) — a 403 with valid
 * credentials almost always means the service is not enabled.
 */

const MEDIA_LIBRARY_PREFIX = /^\/?sitecore\/media library\//i;

/**
 * The handler addresses items by media-library-relative path (or item GUID). Callers
 * naturally paste full content-tree paths, so strip the prefix rather than erroring.
 */
export function toMediaLibraryRelativePath(path: string): string {
    return path.trim().replace(/^\/+/, "").replace(MEDIA_LIBRARY_PREFIX, "").replace(/\/+$/, "");
}

export function mediaServiceUrl(config: Config, database: string, path: string, query: string = ""): string {
    const base = config.powershell.serverUrl.replace(/\/+$/, "");
    // Encode each segment, not the slashes between them.
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    return `${base}/-/script/media/${encodeURIComponent(database)}/${encodedPath}/?${query}`;
}

export function mediaAuthHeader(config: Config): string {
    return "Basic " + Buffer.from(`${config.powershell.username}:${config.powershell.password}`).toString("base64");
}

export function mediaTimeoutMs(): number {
    // The same knob as the script service: media blobs can be large and a CM under load
    // is slow to stream them, so reuse the generous POWERSHELL_TIMEOUT_MS default.
    return Number(process.env.POWERSHELL_TIMEOUT_MS) || 600000;
}

export async function mediaFetch(config: Config, url: string, init: RequestInit): Promise<Response> {
    const response = await fetchWithTimeout(url, {
        ...init,
        headers: {
            "Authorization": mediaAuthHeader(config),
            ...(init.headers ?? {}),
        },
    }, mediaTimeoutMs());

    if (response.status === 403) {
        throw new Error(
            "The SPE media service refused the request (403). Check that the credentials are "
            + "valid AND that the service is enabled on the CM: <mediaUpload enabled=\"true\"> / "
            + "<mediaDownload enabled=\"true\"> under <powershell><services> in the SPE remoting "
            + "config patch."
        );
    }
    if (!response.ok) {
        throw new Error(`SPE media service request failed: ${response.status} ${response.statusText}`);
    }
    return response;
}
