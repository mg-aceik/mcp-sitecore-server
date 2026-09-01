import { describe, it, expect } from "vitest";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { getServer } from "../../src/server";
import { TOOL_SELECTION_GUIDE } from "../../src/tool-guide";
import type { Config } from "../../src/config";

/**
 * The server's `instructions` are the one piece of server metadata a client is expected to
 * put in front of the model, so this checks the name survives the handshake -- not just
 * that the string was assembled correctly in-process.
 *
 * The same applies to the routing block and the guide resource it points at: their whole
 * purpose is to be readable by a connected client, and a guide URI that the instructions
 * name but the server does not serve is worse than no guidance at all.
 */

/** A config complete enough to register every tool; nothing here is dialled. */
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
    const client = new Client({ name: "instructions-test", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    return { client, close: async () => { await client.close(); await server.close(); } };
}

describe("server instructions", () => {
    it("tells the client what the server is called", async () => {
        const { client, close } = await connect();
        try {
            const instructions = client.getInstructions();
            expect(instructions).toBeDefined();
            expect(instructions).toContain(`Sitecore MCP Server: ${config.name}`);
        } finally {
            await close();
        }
    });

    it("names the same server the handshake advertises", async () => {
        const { client, close } = await connect();
        try {
            const advertised = client.getServerVersion()?.name;
            expect(advertised).toBe(`Sitecore MCP Server: ${config.name}`);
            expect(client.getInstructions()).toContain(advertised!);
        } finally {
            await close();
        }
    });

    it("carries the routing block that steers between the tool families", async () => {
        const { client, close } = await connect();
        try {
            const instructions = client.getInstructions()!;
            // The one steer that has to survive: the subtree read, where the two tools
            // differ by orders of magnitude and neither description can see the other.
            expect(instructions).toContain("item-service-get-item-descendants");
            expect(instructions).toContain("authoring-search");
            expect(instructions).toContain("guide://tool-selection");
        } finally {
            await close();
        }
    });
});

describe("tool selection guide resource", () => {
    it("is listed, so a client can find it without being told the URI", async () => {
        const { client, close } = await connect();
        try {
            const { resources } = await client.listResources();
            const guide = resources.find((r) => r.uri === "guide://tool-selection");
            expect(guide).toBeDefined();
            expect(guide!.mimeType).toBe("text/markdown");
        } finally {
            await close();
        }
    });

    it("serves the guidance the instructions promise", async () => {
        const { client, close } = await connect();
        try {
            const { contents } = await client.readResource({ uri: "guide://tool-selection" });
            expect(contents).toHaveLength(1);
            const text = contents[0].text as string;
            // Spot-check the three facts that cost a live round trip to establish, rather
            // than the prose around them.
            expect(text).toContain("41 ms");
            expect(text).toContain("13 levels");
            expect(text).toContain("DESCENDANTS_MAX_ITEMS");
        } finally {
            await close();
        }
    });

    /**
     * Every registered tool has to be reachable from the guide, either by name or through
     * the family it belongs to. The failure this catches is a new tool family arriving with
     * a name shape the guide never mentions: the tool works, nothing errors, and an agent
     * simply has no way to know which surface it is or what it needs switched on. That is
     * silent, and this is the only place it shows up.
     *
     * `FAMILIES` is the naming shapes the guide accounts for. A new entry here is a
     * deliberate statement that the guide covers it; the test exists so that adding one is
     * a decision rather than an omission.
     */
    it("accounts for every registered tool, by name or by family", async () => {
        const FAMILIES = [
            "item-service-", "authoring-", "common-", "provider-", "presentation-",
            "security-", "indexing-", "logging-", "media-", "list-", "get-", "search-",
            "create-component-datasource", "add-rendering-to-placeholder",
            // One pair per configured GraphQL schema, so the names are only known at
            // runtime. `config` reports this server's own configuration rather than
            // reaching Sitecore at all.
            "query-graphql-", "introspection-graphql-", "config",
        ];

        const { client, close } = await connect();
        try {
            const { tools } = await client.listTools();
            expect(tools.length).toBeGreaterThan(100);

            const unaccounted = tools
                .map((t) => t.name)
                .filter((name) =>
                    !TOOL_SELECTION_GUIDE.includes(name)
                    && !FAMILIES.some((f) => name.startsWith(f)));
            expect(unaccounted).toEqual([]);
        } finally {
            await close();
        }
    });
});
