import { describe, it, expect, afterAll } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stat, rm } from "node:fs/promises";
import { client, transport, callTool } from "../../client";

/**
 * Live verification of the media tools against the CM configured in .env, using the
 * Aceik team profile photos that already live in the media library. Requires the
 * mediaUpload / mediaDownload SPE services to be enabled on the CM.
 */

await client.connect(transport);

const SOURCE_MEDIA_PATH = "Project/Stride/Corporate/Migrated/mark-gibbons";
const UPLOAD_DESTINATION = "Project/Stride/Corporate/Migrated/mcp-media-live-test.jpg";
const UPLOAD_FROM_URL_DESTINATION = "Project/Stride/Corporate/Migrated/mcp-media-live-test-url.jpg";
const LOCAL_FILE = join(tmpdir(), "mcp-media-live-test.jpg");

function text(result: { content: Array<Record<string, any>> }): string {
    return result.content.map((block) => block.text ?? "").join("\n");
}

afterAll(async () => {
    await callTool(client, "run-powershell-script", {
        script: `
            foreach ($p in @(
                "master:/sitecore/media library/Project/Stride/Corporate/Migrated/mcp-media-live-test",
                "master:/sitecore/media library/Project/Stride/Corporate/Migrated/mcp-media-live-test-url"
            )) {
                $i = Get-Item $p -ErrorAction SilentlyContinue
                if ($i) { $i | Remove-Item -Force }
            }
        `,
    });
    await rm(LOCAL_FILE, { force: true });
});

describe("media tools (live)", () => {
    it("downloads an existing profile photo to a local file", async () => {
        const result = await callTool(client, "media-download", {
            path: SOURCE_MEDIA_PATH,
            saveTo: LOCAL_FILE,
        });
        expect(result.isError ?? false).toBe(false);
        const body = JSON.parse(text(result));
        expect(body.SavedTo).toBe(LOCAL_FILE);
        expect(body.Size).toBeGreaterThan(100_000);
        expect(body.ContentType).toMatch(/image/i);
        const onDisk = await stat(LOCAL_FILE);
        expect(onDisk.size).toBe(body.Size);
    });

    it("refuses an oversized inline download and names the fix", async () => {
        const result = await callTool(client, "media-download", {
            path: SOURCE_MEDIA_PATH,
            maxBytes: 1000,
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
        const result = await callTool(client, "media-upload", {
            destination: UPLOAD_FROM_URL_DESTINATION,
            sourceUrl: "https://www.aceik.com.au/media/2c4jv4u2/mark-gibbons.jpg",
            alt: "MCP media live test from URL",
        });
        expect(result.isError ?? false).toBe(false);
        const body = text(result);
        expect(body).toMatch(/"ID":"\{[0-9A-F-]+\}"/i);
        expect(body).toContain("mcp-media-live-test-url");
    });
});
