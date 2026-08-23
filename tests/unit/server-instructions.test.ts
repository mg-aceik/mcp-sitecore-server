import { describe, it, expect } from "vitest";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { getServer } from "../../src/server";
import type { Config } from "../../src/config";

/**
 * The server's `instructions` are the one piece of server metadata a client is expected to
 * put in front of the model, so this checks the name survives the handshake -- not just
 * that the string was assembled correctly in-process.
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
});
