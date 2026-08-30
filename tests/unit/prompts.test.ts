import { describe, it, expect, afterEach } from "vitest";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { getServer } from "../../src/server";
import type { Config } from "../../src/config";

/**
 * The prompts, checked over a real connection rather than by calling the registrar.
 *
 * A prompt's whole value is that a client lists it and a model receives its text, so the
 * things worth asserting are the ones that only fail on the wire: that it is listed, that
 * its arguments arrive, that the argument values reach the message, and that the
 * hard-won nuances are actually in the body a model will read. A prompt that lost the
 * splitter or GridParameters guidance still passes a "does it render" test while being
 * useless.
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
    const client = new Client({ name: "prompts-test", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    return {
        client,
        close: async () => { await client.close(); await server.close(); },
    };
}

/** The text of a prompt's first message, which is where all of these put their body. */
function bodyOf(result: { messages: Array<{ content: unknown }> }): string {
    const content = result.messages[0].content as { type: string; text: string };
    expect(content.type).toBe("text");
    return content.text;
}

afterEach(() => {
    delete process.env.TOOL_PROFILE;
    delete process.env.DISABLED_TOOLS;
});

describe("prompts", () => {
    it("advertises all three prompts with titles and descriptions", async () => {
        const { client, close } = await connect();
        try {
            const { prompts } = await client.listPrompts();
            const byName = new Map(prompts.map((p) => [p.name, p]));

            expect([...byName.keys()].sort()).toEqual([
                "add-component-to-page",
                "bulk-update-items",
                "diagnose-connection",
            ]);
            for (const prompt of prompts) {
                expect(prompt.title, prompt.name).toBeTruthy();
                expect(prompt.description, prompt.name).toBeTruthy();
            }
        } finally {
            await close();
        }
    });

    it("declares add-component-to-page's arguments, with only page and component required", async () => {
        const { client, close } = await connect();
        try {
            const { prompts } = await client.listPrompts();
            const prompt = prompts.find((p) => p.name === "add-component-to-page");
            const args = prompt?.arguments ?? [];
            const required = args.filter((a) => a.required).map((a) => a.name).sort();

            expect(args.map((a) => a.name).sort()).toEqual(["component", "page", "placeholder", "site"]);
            expect(required).toEqual(["component", "page"]);
        } finally {
            await close();
        }
    });

    it("puts the caller's page, component and placeholder into the message", async () => {
        const { client, close } = await connect();
        try {
            const result = await client.getPrompt({
                name: "add-component-to-page",
                arguments: {
                    page: "/sitecore/content/Tenant/Site/Home/About",
                    component: "Column Splitter",
                    placeholder: "/headless-main/page-section-1",
                    site: "Site",
                },
            });
            const body = bodyOf(result);

            expect(body).toContain("/sitecore/content/Tenant/Site/Home/About");
            expect(body).toContain("Column Splitter");
            expect(body).toContain("/headless-main/page-section-1");
            expect(body).toContain("Site");
        } finally {
            await close();
        }
    });

    it("still renders when only the required arguments are supplied", async () => {
        const { client, close } = await connect();
        try {
            const body = bodyOf(await client.getPrompt({
                name: "add-component-to-page",
                arguments: { page: "{110D559F-DEA5-42EA-9C1C-8A5DF7E70EF9}", component: "RichText" },
            }));

            // No placeholder given, so it must tell the agent to read the layout and choose
            // rather than leaving a hole where the placeholder should be.
            expect(body).toContain("read the page's current layout first");
            expect(body).not.toContain("undefined");
        } finally {
            await close();
        }
    });

    // The composition knowledge is the reason this prompt exists. Each of these is a
    // mistake that produces a page which saves, renders, and is wrong -- so losing any
    // one of them silently guts the prompt.
    it("carries the composition nuances a wrong layout depends on", async () => {
        const { client, close } = await connect();
        try {
            const body = bodyOf(await client.getPrompt({
                name: "add-component-to-page",
                arguments: { page: "/sitecore/content/Home", component: "Container" },
            }));

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
            expect(body).toMatch(/PageSection\` is not an SXA rendering/);
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

    it("declares bulk-update-items's arguments, with change and rootPath required", async () => {
        const { client, close } = await connect();
        try {
            const { prompts } = await client.listPrompts();
            const prompt = prompts.find((p) => p.name === "bulk-update-items");
            const args = prompt?.arguments ?? [];
            const required = args.filter((a) => a.required).map((a) => a.name).sort();

            expect(args.map((a) => a.name).sort()).toEqual(["change", "criteria", "rootPath"]);
            expect(required).toEqual(["change", "rootPath"]);
        } finally {
            await close();
        }
    });

    it("puts the caller's change, root and criteria into the bulk-update message", async () => {
        const { client, close } = await connect();
        try {
            const body = bodyOf(await client.getPrompt({
                name: "bulk-update-items",
                arguments: {
                    change: "reset __Final Renderings to the template default",
                    rootPath: "/sitecore/content/Tenant/Site/Home",
                    criteria: "Article Page items containing the Related Pages rendering",
                },
            }));

            expect(body).toContain("reset __Final Renderings to the template default");
            expect(body).toContain("/sitecore/content/Tenant/Site/Home");
            expect(body).toContain("Article Page items containing the Related Pages rendering");
        } finally {
            await close();
        }
    });

    // The safety pattern is the reason this prompt exists. Each of these is a mistake
    // that turns a routine bulk update into a mass write of the wrong thing.
    it("carries the bulk-update safeguards a mass write depends on", async () => {
        const { client, close } = await connect();
        try {
            const body = bodyOf(await client.getPrompt({
                name: "bulk-update-items",
                arguments: {
                    change: "set Robots to noindex",
                    rootPath: "/sitecore/content/Tenant/Site/Home",
                },
            }));

            // No criteria given, so it must send the agent to the user rather than
            // leaving the filter to be invented.
            expect(body).toMatch(/establish with the user which items/i);
            expect(body).not.toContain("undefined");

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

            // Scope is always a named subtree, and publishing is a separate decision.
            expect(body).toMatch(/never run an unrooted/i);
            expect(body).toMatch(/unpublished/i);
        } finally {
            await close();
        }
    });

    it("carries the misleading failure signatures in diagnose-connection", async () => {
        const { client, close } = await connect();
        try {
            const body = bodyOf(await client.getPrompt({
                name: "diagnose-connection",
                arguments: {},
            }));

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

    it("accepts diagnose-connection's optional symptom and narrows to one surface", async () => {
        const { client, close } = await connect();
        try {
            const body = bodyOf(await client.getPrompt({
                name: "diagnose-connection",
                arguments: { surface: "powershell", symptom: "400 with an HTML body" },
            }));

            expect(body).toContain("Check the powershell surface only.");
            expect(body).toContain("400 with an HTML body");
        } finally {
            await close();
        }
    });

    // A client lists prompts separately from tools, and an agent has no reason to go
    // looking -- so a prompt nothing points at is a prompt nothing reaches. The guide
    // resource is where the server's instructions already send an agent before it starts
    // choosing, which makes it the one place that pointer lands in time.
    it("discloses every registered prompt in the tool-selection guide", async () => {
        const { client, close } = await connect();
        try {
            const [{ prompts }, { contents }] = await Promise.all([
                client.listPrompts(),
                client.readResource({ uri: "guide://tool-selection" }),
            ]);
            const guide = contents[0].text as string;

            expect(prompts.length).toBeGreaterThan(0);
            const undisclosed = prompts
                .map((prompt) => prompt.name)
                .filter((name) => !guide.includes(name));
            expect(undisclosed).toEqual([]);
        } finally {
            await close();
        }
    });

    it("says what each prompt is for, not just its name", async () => {
        const { client, close } = await connect();
        try {
            const { contents } = await client.readResource({ uri: "guide://tool-selection" });
            const guide = contents[0].text as string;

            // The name alone does not tell an agent when to reach for it, which is the
            // whole job of a pointer.
            expect(guide).toMatch(/adding a component to a page/i);
            expect(guide).toMatch(/the same change across many items/i);
            expect(guide).toMatch(/a tool returned an error/i);
        } finally {
            await close();
        }
    });

    // Offering a workflow whose first tool call does not exist is worse than not offering
    // it: the user picks it and the agent fails halfway through.
    it("withholds add-component-to-page when the composition tools are gated out", async () => {
        process.env.TOOL_PROFILE = "no-spe";
        const { client, close } = await connect();
        try {
            const { prompts } = await client.listPrompts();
            const names = prompts.map((p) => p.name);

            expect(names).not.toContain("add-component-to-page");
            // The bulk-update workflow is a run-powershell-script script, gone with SPE.
            expect(names).not.toContain("bulk-update-items");
            // Diagnosis is most wanted precisely when a surface is missing.
            expect(names).toContain("diagnose-connection");
        } finally {
            await close();
        }
    });

    it("withholds it when add-rendering-to-placeholder alone is disabled", async () => {
        process.env.DISABLED_TOOLS = "add-rendering-to-placeholder";
        const { client, close } = await connect();
        try {
            const { prompts } = await client.listPrompts();
            expect(prompts.map((p) => p.name)).not.toContain("add-component-to-page");
        } finally {
            await close();
        }
    });

    it("withholds bulk-update-items when run-powershell-script alone is disabled", async () => {
        process.env.DISABLED_TOOLS = "run-powershell-script";
        const { client, close } = await connect();
        try {
            const { prompts } = await client.listPrompts();
            const names = prompts.map((p) => p.name);

            expect(names).not.toContain("bulk-update-items");
            // The composition prompt rides add-rendering-to-placeholder, which is a
            // different tool -- disabling the raw script runner must not take it too.
            expect(names).toContain("add-component-to-page");
        } finally {
            await close();
        }
    });
});
