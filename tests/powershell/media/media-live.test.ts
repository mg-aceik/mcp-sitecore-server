import { describe, it, expect, afterAll } from "vitest";
import { stat, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { client, transport, callTool } from "../../client";

/**
 * Live exercise of media-upload and media-download against the CM in .env. Requires the
 * mediaUpload / mediaDownload SPE services to be enabled.
 *
 * The suite used to download a photo that existed in one instance's media library. It now
 * uploads its own image first — inline base64, a few hundred bytes of JPEG — and deletes the
 * whole folder afterwards, so it needs nothing to be there beforehand.
 */

await client.connect(transport);

const FOLDER = `MCP-Media-Tests-${Date.now().toString(36)}`;
const SOURCE_MEDIA_PATH = `${FOLDER}/source`;
const UPLOAD_DESTINATION = `${FOLDER}/mcp-media-live-test.jpg`;
// .ico, because the extension has to match the bytes the URL serves -- Sitecore
// answers 500 when it is handed an icon named as a JPEG.
const UPLOAD_FROM_URL_DESTINATION = `${FOLDER}/mcp-media-live-test-url.ico`;
const LOCAL_FILE = join(tmpdir(), "mcp-media-live-test.jpg");

/**
 * A 1x1 JPEG. Big enough to be a real image to Sitecore, small enough to pass inline —
 * which is what makes the fixture self-contained.
 */
const ONE_PIXEL_JPEG =
    "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a"
    + "HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA"
    + "AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==";

function text(result: { content: Array<Record<string, any>> }): string {
    return result.content.map((block) => block.text ?? "").join("\n");
}

const seeded = await callTool(client, "media-upload", {
    destination: `${SOURCE_MEDIA_PATH}.jpg`,
    content: ONE_PIXEL_JPEG,
    alt: "MCP media fixture",
});
if (seeded.isError) {
    throw new Error(`could not seed the media fixture: ${text(seeded)}`);
}

afterAll(async () => {
    await callTool(client, "run-powershell-script", {
        script: `
            $folder = Get-Item "master:/sitecore/media library/${FOLDER}" -ErrorAction SilentlyContinue
            # -Permanently, or the folder lands in the recycle bin and every run leaves one
            # behind for the archive tests to trip over.
            if ($folder) { Remove-Item -Path $folder.Paths.Path -Recurse -Permanently }
        `,
    });
    await rm(LOCAL_FILE, { force: true });
});

describe("media tools (live)", () => {
    it("downloads the seeded image to a local file", async () => {
        const result = await callTool(client, "media-download", {
            path: SOURCE_MEDIA_PATH,
            saveTo: LOCAL_FILE,
        });
        expect(result.isError ?? false).toBe(false);
        const body = JSON.parse(text(result));
        expect(body.SavedTo).toBe(LOCAL_FILE);
        expect(body.Size).toBeGreaterThan(0);
        expect(body.ContentType).toMatch(/image/i);
        const onDisk = await stat(LOCAL_FILE);
        expect(onDisk.size).toBe(body.Size);
    });

    it("refuses an oversized inline download and names the fix", async () => {
        // maxBytes below the file's own size, so the guard fires and has to point at saveTo.
        const result = await callTool(client, "media-download", {
            path: SOURCE_MEDIA_PATH,
            maxBytes: 1,
        });
        expect(result.isError).toBe(true);
        expect(text(result)).toContain("saveTo");
    });

    it("uploads from a local file and returns the created item with alt text", async () => {
        const result = await callTool(client, "media-upload", {
            destination: UPLOAD_DESTINATION,
            filePath: LOCAL_FILE,
            alt: "MCP media live test",
        });
        expect(result.isError ?? false).toBe(false);
        const body = text(result);
        expect(body).toMatch(/"ID":"\{[0-9A-F-]+\}"/i);
        expect(body).toContain("mcp-media-live-test");
        expect(body).toContain("MCP media live test");
    });

    it("uploads straight from a source URL — the migration path", async () => {
        // Any stable public image will do; this one is Sitecore's own.
        const result = await callTool(client, "media-upload", {
            destination: UPLOAD_FROM_URL_DESTINATION,
            sourceUrl: "https://www.sitecore.com/favicon.ico",
            alt: "MCP media live test from URL",
        });
        expect(result.isError ?? false, text(result)).toBe(false);
        const body = text(result);
        expect(body).toMatch(/"ID":"\{[0-9A-F-]+\}"/i);
        expect(body).toContain("mcp-media-live-test-url");
    });
});
