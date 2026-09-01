import { afterEach, describe, expect, it, vi } from "vitest";
import {
    LocalFileAccessError,
    SourceUrlError,
    assertFetchableSourceUrl,
    fetchSourceUrl,
    resolveLocalMediaPath,
} from "@/tools/powershell/media/local-files.js";
import {
    mediaServiceUrl,
    toMediaLibraryRelativePath,
} from "@/tools/powershell/media/media-service.js";
import { quotePowerShellString } from "@/tools/powershell/command-builder.js";
import path from "node:path";
import os from "node:os";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
});

describe("resolveLocalMediaPath", () => {
    it("allows an unconfined path on stdio, where the server is the user's own subprocess", () => {
        const resolved = resolveLocalMediaPath("photo.jpg", "filePath", { TRANSPORT: "stdio" });
        expect(resolved).toBe(path.resolve("photo.jpg"));
    });

    it("refuses local file access over HTTP, where the port may be reachable by anyone", () => {
        expect(() => resolveLocalMediaPath("/etc/passwd", "filePath", {
            TRANSPORT: "streamable-http",
        })).toThrow(LocalFileAccessError);
    });

    it("treats unset and unrecognised TRANSPORT as stdio, matching how the transport is picked", () => {
        // index.ts starts stdio for anything that is not 'streamable-http', so refusing
        // here on "not stdio" would break the default local setup.
        expect(() => resolveLocalMediaPath("photo.jpg", "filePath", {})).not.toThrow();
        expect(() => resolveLocalMediaPath("photo.jpg", "filePath", { TRANSPORT: "typo" }))
            .not.toThrow();
        expect(() => resolveLocalMediaPath("photo.jpg", "filePath", { TRANSPORT: "sse" }))
            .toThrow(LocalFileAccessError);
    });

    it("confines a path to MEDIA_LOCAL_FILE_ROOT when one is set", () => {
        const root = path.join(os.tmpdir(), "mcp-media-root");
        const resolved = resolveLocalMediaPath("nested/photo.jpg", "saveTo", {
            TRANSPORT: "streamable-http",
            MEDIA_LOCAL_FILE_ROOT: root,
        });
        expect(resolved).toBe(path.join(root, "nested", "photo.jpg"));
    });

    it("rejects a traversal out of MEDIA_LOCAL_FILE_ROOT", () => {
        const root = path.join(os.tmpdir(), "mcp-media-root");
        expect(() => resolveLocalMediaPath("../../secrets.env", "filePath", {
            MEDIA_LOCAL_FILE_ROOT: root,
        })).toThrow(/outside MEDIA_LOCAL_FILE_ROOT/);
    });

    it("rejects an absolute path that escapes the configured root", () => {
        const root = path.join(os.tmpdir(), "mcp-media-root");
        const outside = path.join(os.tmpdir(), "elsewhere", "photo.jpg");
        expect(() => resolveLocalMediaPath(outside, "saveTo", {
            MEDIA_LOCAL_FILE_ROOT: root,
        })).toThrow(LocalFileAccessError);
    });

    it("rejects the root itself, which is a directory rather than a file", () => {
        const root = path.join(os.tmpdir(), "mcp-media-root");
        expect(() => resolveLocalMediaPath(".", "saveTo", {
            MEDIA_LOCAL_FILE_ROOT: root,
        })).toThrow(LocalFileAccessError);
    });
});

describe("assertFetchableSourceUrl", () => {
    it("accepts a public https URL", async () => {
        await expect(assertFetchableSourceUrl("https://example.com/logo.png", {}))
            .resolves.toBeInstanceOf(URL);
    });

    it("refuses a non-http scheme rather than letting fetch decide", async () => {
        await expect(assertFetchableSourceUrl("file:///etc/passwd", {}))
            .rejects.toThrow(SourceUrlError);
    });

    it("refuses loopback", async () => {
        await expect(assertFetchableSourceUrl("http://127.0.0.1/admin", {}))
            .rejects.toThrow(/private, loopback or link-local/);
    });

    it("refuses the cloud metadata endpoint", async () => {
        await expect(assertFetchableSourceUrl("http://169.254.169.254/latest/meta-data/", {}))
            .rejects.toThrow(/private, loopback or link-local/);
    });

    it("refuses RFC 1918 space", async () => {
        await expect(assertFetchableSourceUrl("http://10.0.0.5/image.png", {}))
            .rejects.toThrow(SourceUrlError);
        await expect(assertFetchableSourceUrl("http://192.168.1.1/image.png", {}))
            .rejects.toThrow(SourceUrlError);
        await expect(assertFetchableSourceUrl("http://172.20.0.1/image.png", {}))
            .rejects.toThrow(SourceUrlError);
    });

    it("allows a private address when the deployment opts in", async () => {
        await expect(assertFetchableSourceUrl("http://10.0.0.5/image.png", {
            MEDIA_ALLOW_PRIVATE_SOURCE_URL: "true",
        })).resolves.toBeInstanceOf(URL);
    });

    it("refuses a malformed URL with a message naming the parameter", async () => {
        await expect(assertFetchableSourceUrl("not a url", {}))
            .rejects.toThrow(/'sourceUrl' is not a valid URL/);
    });
});

describe("fetchSourceUrl redirect handling", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("re-validates each redirect and refuses one pointing at the metadata endpoint", async () => {
        // The whole point of the guard: a public host that passes the initial check must
        // not be able to bounce the fetch to 169.254.169.254 via a 302.
        const fetchMock = vi.fn(async () => new Response(null, {
            status: 302,
            headers: { location: "http://169.254.169.254/latest/meta-data/" },
        }));
        vi.stubGlobal("fetch", fetchMock);

        await expect(fetchSourceUrl("https://example.com/logo.png", 1000, {}))
            .rejects.toThrow(/private, loopback or link-local/);
    });

    it("follows a redirect whose target also passes the guard", async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response(null, {
                status: 302,
                headers: { location: "https://example.com/real.png" },
            }))
            .mockResolvedValueOnce(new Response("bytes", { status: 200 }));
        vi.stubGlobal("fetch", fetchMock);

        const { response, url } = await fetchSourceUrl("https://example.com/logo.png", 1000, {});
        expect(response.status).toBe(200);
        expect(url.href).toBe("https://example.com/real.png");
    });

    it("refuses to follow more than the redirect limit", async () => {
        const fetchMock = vi.fn(async () => new Response(null, {
            status: 302,
            headers: { location: "https://example.com/next" },
        }));
        vi.stubGlobal("fetch", fetchMock);

        await expect(fetchSourceUrl("https://example.com/logo.png", 1000, {}))
            .rejects.toThrow(/exceeded 5 redirects/);
    });
});

describe("media service addressing", () => {
    it("strips the media library prefix a caller naturally pastes", () => {
        expect(toMediaLibraryRelativePath("/sitecore/media library/Project/logo.png"))
            .toBe("Project/logo.png");
        expect(toMediaLibraryRelativePath("Project/logo.png")).toBe("Project/logo.png");
    });

    it("encodes each path segment without encoding the separators", () => {
        const url = mediaServiceUrl(
            { powershell: { serverUrl: "https://cm.example/" } } as any,
            "master",
            "Project/My Folder/team photo.jpg"
        );
        expect(url).toContain("/-/script/media/master/Project/My%20Folder/team%20photo.jpg/");
    });
});

describe("media-upload script construction", () => {
    // The database used to be interpolated raw into the read-back script, which made it a
    // PowerShell injection point in a tool that runs as the SPE remoting account.
    it("quotes a database name the way every other interpolated value is quoted", () => {
        expect(quotePowerShellString("master'; Remove-Item -Recurse 'x"))
            .toBe("'master''; Remove-Item -Recurse ''x'");
    });

    it("the schema rejects a database name that is not a plain identifier", async () => {
        const { z } = await import("zod");
        const schema = z.string().regex(/^[A-Za-z][A-Za-z0-9_-]*$/);
        expect(schema.safeParse("master").success).toBe(true);
        expect(schema.safeParse("master'; Write-Error 'x").success).toBe(false);
        expect(schema.safeParse("").success).toBe(false);
    });
});
