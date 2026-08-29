import { describe, it, expect } from "vitest";
import { describeFailedSpeResponse } from "../../src/tools/powershell/client";

/**
 * These cover the diagnostics, not the happy path.
 *
 * The regression they exist for: both clients used to throw `response.statusText` and
 * discard the body. A cloud CM answers an unauthenticated remoting call by redirecting to
 * its identity provider, which replies with a 3KB HTML page saying exactly what is wrong —
 * and all the caller ever saw was the words "Bad Request". That was enough to make a
 * credentials problem look like a disabled `remoting` service, and it cost a full
 * misdiagnosis before anyone read the body.
 */

function html(body: string, status: number, headers: Record<string, string> = {}): Response {
    return new Response(body, {
        status,
        headers: { "Content-Type": "text/html; charset=utf-8", ...headers },
    });
}

const AUTH0_PAGE = `<!doctype html><html><head><title>one-sc-production</title>
<style>.x{color:red}</style><script>var a=1;</script></head>
<body><h1>Oops!, something went wrong</h1>
<p>invalid_request: You may have pressed the back button, refreshed during login,
or there is some issue with cookies, since we couldn&#39;t find your session.</p>
</body></html>`;

describe("describeFailedSpeResponse", () => {
    const url = "https://cm.example.com/-/script/script/?sessionId=x";

    it("keeps the status code, which statusText alone loses", async () => {
        const message = await describeFailedSpeResponse(html("nope", 400), url);
        expect(message).toContain("400");
        expect(message).toContain("/-/script/script/");
    });

    it("says the response came from the identity provider, not Sitecore", async () => {
        const message = await describeFailedSpeResponse(
            html(AUTH0_PAGE, 400, { "x-auth0-requestid": "abc123" }),
            url
        );
        expect(message).toContain("came from Auth0, not Sitecore");
        expect(message).toMatch(/never reached the SPE remoting endpoint/);
        // The credentials angle is the actionable part; a reader must not be sent after
        // the remoting service instead.
        expect(message).toMatch(/credentials|Basic authentication/);
    });

    it("carries the identity provider's own wording, stripped of markup", async () => {
        const message = await describeFailedSpeResponse(
            html(AUTH0_PAGE, 400, { "x-auth0-requestid": "abc123" }),
            url
        );
        expect(message).toContain("invalid_request");
        expect(message).toContain("couldn't find your session");
        // Markup, scripts and styles are noise; the wording is the point.
        expect(message).not.toContain("<h1>");
        expect(message).not.toContain("var a=1");
        expect(message).not.toContain("color:red");
    });

    it("says a 429 did not come from SPE, which does no rate limiting of its own", async () => {
        const message = await describeFailedSpeResponse(
            html(AUTH0_PAGE, 429, { "x-auth0-requestid": "abc123" }),
            url
        );
        expect(message).toContain("429");
        expect(message).toContain("does not come from SPE");
        // The actionable half: a 429 here is a credentials symptom, not a pacing one.
        expect(message).toContain("credentials");
    });

    it("points a 404 at the remoting service, which is what 404 actually means here", async () => {
        const message = await describeFailedSpeResponse(new Response("", { status: 404 }), url);
        expect(message).toMatch(/remoting service is not enabled|SPE is not/);
    });

    it("does not claim Auth0 answered when it did not", async () => {
        const message = await describeFailedSpeResponse(
            new Response("Access to the path is denied.", { status: 403 }),
            url
        );
        expect(message).not.toContain("Auth0");
        expect(message).toContain("403");
        expect(message).toContain("Access to the path is denied.");
    });

    it("still reports the status when the body cannot be read", async () => {
        // A response whose body has already been consumed: text() throws.
        const consumed = new Response("gone", { status: 500 });
        await consumed.text();
        const message = await describeFailedSpeResponse(consumed, url);
        expect(message).toContain("500");
    });

    it("collapses whitespace so a message stays one readable line", async () => {
        const message = await describeFailedSpeResponse(
            new Response("line one\n\n   line two\t\tline three", { status: 400 }),
            url
        );
        expect(message).toContain("line one line two line three");
    });

    it("bounds the excerpt rather than pasting a whole error page", async () => {
        const message = await describeFailedSpeResponse(
            new Response("x".repeat(50_000), { status: 400 }),
            url
        );
        expect(message.length).toBeLessThan(1200);
    });
});
