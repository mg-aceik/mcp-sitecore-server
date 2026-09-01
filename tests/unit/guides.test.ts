import { describe, it, expect, afterEach } from "vitest";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { getServer } from "../../src/server";
import type { Config } from "../../src/config";

/**
 * The `guide://` resources, checked over a real connection rather than by calling the
 * registrar.
 *
 * A guide's whole value is that a client lists it and a model can read its text, so the
 * things worth asserting are the ones that only fail on the wire: that it is listed, that
 * it is reachable by URI, and that the hard-won nuances are actually in the body a model
 * will read. A guide that lost the splitter or GridParameters guidance still passes a
 * "does it render" test while being useless.
 *
 * These three were prompts too, from the same strings; the prompt half is gone. What a
 * prompt bought was discovery — a client puts a slash command in front of the user — so
 * the discovery assertions below matter more than they did: the tool-selection guide has
 * to name every URI, and the two tools each guide is about have to name it in their own
 * descriptions, which is where an agent already mid-task meets it.
 */

const config = {
    name: "@antonytm/mcp-sitecore-server 2.0.0",
    version: "2.0.0",
    graphQL: {
        endpoint: "https://cm.example.com/sitecore/api/graph/",
        schemas: ["edge", "master"],
        apiKey: "{00000000-0000-0000-0000-000000000000}",
        headers: {},
    },
    itemService: {
        domain: "sitecore",
        username: "admin",
        password: "b",
        serverUrl: "https://cm.example.com/",
    },
    powershell: {
        domain: "sitecore",
        username: "admin",
        password: "b",
        serverUrl: "https://cm.example.com/",
    },
    authoring: {
        endpoint: "https://cm.example.com/sitecore/api/authoring/graphql/v1/",
        token: "",
        clientId: "",
        clientSecret: "",
        authority: "https://auth.sitecorecloud.io",
        audience: "https://api.sitecorecloud.io",
    },
    authorizationHeader: "",
} satisfies Config;

async function connect() {
    const server = await getServer(config);
    const client = new Client({ name: "guides-test", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    return {
        client,
        close: async () => { await client.close(); await server.close(); },
    };
}

/** The text of a guide resource, which is where all of these put their body. */
async function guideText(client: Client, uri: string): Promise<string> {
    const { contents } = await client.readResource({ uri });
    return contents[0].text as string;
}

afterEach(() => {
    delete process.env.TOOL_PROFILE;
    delete process.env.DISABLED_TOOLS;
});

describe("guide resources", () => {
    it("advertises all three guides with titles, descriptions and markdown bodies", async () => {
        const { client, close } = await connect();
        try {
            const { resources } = await client.listResources();
            const byUri = new Map(resources.map((r) => [r.uri, r]));

            for (const uri of [
                "guide://compose-page",
                "guide://bulk-update",
                "guide://diagnose-connection",
            ]) {
                const resource = byUri.get(uri);
                expect(resource, uri).toBeTruthy();
                expect(resource!.title, uri).toBeTruthy();
                expect(resource!.description, uri).toBeTruthy();
                expect(resource!.mimeType, uri).toBe("text/markdown");

                expect((await guideText(client, uri)).length, uri).toBeGreaterThan(1000);
            }
        } finally {
            await close();
        }
    });

    // The prompts are gone deliberately. A prompt is one-shot and user-triggered, and the
    // failures these bodies guard against surface mid-task; a leftover registration would
    // put the same text back on a channel that cannot be re-read.
    it("registers no prompts at all", async () => {
        const { client, close } = await connect();
        try {
            const { prompts } = await client.listPrompts();
            expect(prompts).toEqual([]);
        } finally {
            await close();
        }
    });

    it("uses the shared 'ground truth' vocabulary in all three guides", async () => {
        // The three guides guard the same failure — a placeholder path, a GUID or an
        // error signature taken on faith — and say so with one repeated term rather than
        // a paragraph restated per site. A rewrite that drops the term from one loses the
        // link between them, which no other assertion here would catch.
        const { client, close } = await connect();
        try {
            for (const uri of [
                "guide://compose-page",
                "guide://bulk-update",
                "guide://diagnose-connection",
            ]) {
                const body = await guideText(client, uri);
                expect(body, `${uri} should carry the shared term`).toMatch(/ground truth/i);
            }
        } finally {
            await close();
        }
    });

    // The composition knowledge is the reason this guide exists. Each of these is a
    // mistake that produces a page which saves, renders, and is wrong -- so losing any
    // one of them silently guts the guide.
    it("carries the composition nuances a wrong layout depends on", async () => {
        const { client, close } = await connect();
        try {
            const body = await guideText(client, "guide://compose-page");

            // Runtime placeholder paths, and the dynamic id embedded in each segment.
            expect(body).toContain("/headless-main/page-section-1/container-2");
            expect(body).toContain("DynamicPlaceholderId");
            expect(body).toContain("container-{*}");
            expect(body).toMatch(/never invent the number/i);

            // ChildPlaceholder is the nesting mechanism, and null is not a failure.
            expect(body).toContain("ChildPlaceholder");
            expect(body).toMatch(/not a failure/i);

            // Splitters: one placeholder per column, named per column, not after the
            // rendering -- which is exactly why ChildPlaceholder comes back null.
            expect(body).toContain("Column Splitter");
            expect(body).toContain("column-1-");

            // The sampled path is an illustration of the shape, not a set of names to
            // expect: PageSection is one solution's component, not an SXA rendering, and
            // headless-main is a site template's choice. An agent that pattern-matches on
            // these instead of reading the page is the failure this guards.
            expect(body).toMatch(/only the shape generalises/i);
            expect(body).toMatch(/PageSection. is not an SXA rendering/);
            expect(body).toMatch(/stock SXA renderings/i);

            // GridParameters is an item reference and must never be fabricated.
            expect(body).toContain("GridParameters");
            expect(body).toMatch(/not a class string/i);
            expect(body).toContain("FieldNames");

            // The allow-list check, and the rule about not forcing past it.
            expect(body).toContain("get-allowed-components-by-placeholder");
            expect(body).toContain("add-rendering-to-placeholder");
            expect(body).toContain("force: true");
        } finally {
            await close();
        }
    });

    // The safety pattern is the reason this guide exists. Each of these is a mistake
    // that turns a routine bulk update into a mass write of the wrong thing.
    it("carries the bulk-update safeguards a mass write depends on", async () => {
        const { client, close } = await connect();
        try {
            const body = await guideText(client, "guide://bulk-update");

            // The root and the filter come from the user, always: an inferred root is the
            // one mistake here that cannot be walked back.
            expect(body).toMatch(/establish both with the user/i);
            expect(body).toMatch(/never run unrooted/i);
            expect(body).toMatch(/Never run an unrooted or/i);

            // Dry run first, as a separate execution the user approves.
            expect(body).toContain("$dryRun = $true");
            expect(body).toMatch(/dry run first, as a separate execution/i);

            // Every GUID resolved, never guessed; raw-XML matching normalised.
            expect(body).toMatch(/never type a GUID you\s+have not read back/i);
            expect(body).toMatch(/normalise GUIDs/i);

            // The edit bracket, with the failure path that cancels rather than leaks.
            expect(body).toContain("BeginEdit");
            expect(body).toContain("CancelEdit");

            // Reset() restores inheritance; copying the value freezes it.
            expect(body).toContain(".Reset()");
            expect(body).toMatch(/restores\s+inheritance/i);

            // Versioned/language fields update one version at a time.
            expect(body).toContain("-Language * -Version *");

            // Remoting, not the ISE: no Write-Progress, bounded output.
            expect(body).toMatch(/not the ISE/i);
            expect(body).toContain("Write-Progress");

            // Publishing stays a separate decision.
            expect(body).toMatch(/unpublished/i);
        } finally {
            await close();
        }
    });

    it("carries the misleading failure signatures in diagnose-connection", async () => {
        const { client, close } = await connect();
        try {
            const body = await guideText(client, "guide://diagnose-connection");

            // The two failures that are actively misleading on their face.
            expect(body).toContain("AUTH_NOT_AUTHENTICATED");
            expect(body).toMatch(/HTTP 200 is not a success/i);
            expect(body).toContain("x-auth0-requestid");
            // The 403 that has two indistinguishable causes, and how to tell them apart.
            expect(body).toContain("ServicesOffPolicy");
            expect(body).toContain("/sitecore/api/ssc/auth/login");
            // Secrets must not be printed back.
            expect(body).toMatch(/never print a secret/i);
        } finally {
            await close();
        }
    });
});

describe("guide discovery", () => {
    // A client lists resources separately from tools, and an agent has no reason to go
    // looking -- so a guide nothing points at is a guide nothing reaches. The
    // tool-selection guide is where the server's instructions already send an agent
    // before it starts choosing, which makes it the one pointer that lands in time.
    it("discloses every registered guide in the tool-selection guide", async () => {
        const { client, close } = await connect();
        try {
            const [{ resources }, guide] = await Promise.all([
                client.listResources(),
                guideText(client, "guide://tool-selection"),
            ]);

            const guideUris = resources
                .map((r) => r.uri)
                .filter((uri) => uri.startsWith("guide://") && uri !== "guide://tool-selection");
            expect(guideUris.length).toBeGreaterThan(0);
            expect(guideUris.filter((uri) => !guide.includes(uri))).toEqual([]);
        } finally {
            await close();
        }
    });

    it("says what each guide is for, not just its URI", async () => {
        const { client, close } = await connect();
        try {
            const guide = await guideText(client, "guide://tool-selection");

            // The URI alone does not tell an agent when to reach for it, which is the
            // whole job of a pointer.
            expect(guide).toMatch(/adding a component to a page/i);
            expect(guide).toMatch(/the same change across many items/i);
            expect(guide).toMatch(/a tool returned an error/i);
        } finally {
            await close();
        }
    });

    // The second pointer, and the one that lands mid-task: the description of the tool
    // each guide is about. An agent several calls into a build is reading the tool, not
    // the routing guide it passed at the start.
    it("names each guide from the description of the tool it is about", async () => {
        const { client, close } = await connect();
        try {
            const { tools } = await client.listTools();
            const byName = new Map(tools.map((t) => [t.name, t]));

            expect(byName.get("run-powershell-script")?.description)
                .toContain("guide://bulk-update");
            expect(byName.get("add-rendering-to-placeholder")?.description)
                .toContain("guide://compose-page");
        } finally {
            await close();
        }
    });
});

// Offering a procedure whose every step names an absent tool is not a useful document,
// it is a misleading one -- so a guide is gated on the same tools its steps call.
describe("gating", () => {
    async function guideUris() {
        const { client, close } = await connect();
        try {
            const { resources } = await client.listResources();
            return resources.map((r) => r.uri);
        } finally {
            await close();
        }
    }

    it("withholds both composition guides under no-spe", async () => {
        process.env.TOOL_PROFILE = "no-spe";
        const uris = await guideUris();

        expect(uris).not.toContain("guide://compose-page");
        // The bulk-update procedure is a run-powershell-script script, gone with SPE.
        expect(uris).not.toContain("guide://bulk-update");
        // Diagnosis is most wanted precisely when a surface is missing.
        expect(uris).toContain("guide://diagnose-connection");
    });

    it("withholds compose-page when add-rendering-to-placeholder alone is disabled", async () => {
        process.env.DISABLED_TOOLS = "add-rendering-to-placeholder";
        const uris = await guideUris();

        expect(uris).not.toContain("guide://compose-page");
    });

    it("withholds bulk-update when run-powershell-script alone is disabled", async () => {
        process.env.DISABLED_TOOLS = "run-powershell-script";
        const uris = await guideUris();

        expect(uris).not.toContain("guide://bulk-update");
        // The composition guide rides add-rendering-to-placeholder, which is a
        // different tool -- disabling the raw script runner must not take it too.
        expect(uris).toContain("guide://compose-page");
    });
});
