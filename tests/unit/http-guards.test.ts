import { describe, it, expect } from "vitest";
import {
    checkRequestHost,
    hostnameOf,
    resolveAllowedHosts,
} from "../../src/http-guards";

describe("hostnameOf", () => {
    it("reads a bare authority", () => {
        expect(hostnameOf("localhost")).toBe("localhost");
        expect(hostnameOf("localhost:3001")).toBe("localhost");
        expect(hostnameOf("127.0.0.1:4001")).toBe("127.0.0.1");
    });

    it("reads a whole origin", () => {
        expect(hostnameOf("http://localhost:3001")).toBe("localhost");
        expect(hostnameOf("https://mcp.example.com")).toBe("mcp.example.com");
    });

    it("unwraps an IPv6 literal, with or without a port", () => {
        expect(hostnameOf("[::1]:3001")).toBe("::1");
        expect(hostnameOf("[::1]")).toBe("::1");
        expect(hostnameOf("http://[::1]:3001")).toBe("::1");
    });

    it("normalises case, so an allowlist entry matches whatever the client sent", () => {
        expect(hostnameOf("MCP.Example.COM")).toBe("mcp.example.com");
    });

    it("returns undefined for a value with no hostname in it", () => {
        expect(hostnameOf(undefined)).toBeUndefined();
        expect(hostnameOf("")).toBeUndefined();
        expect(hostnameOf("   ")).toBeUndefined();
        // `Origin: null` is what a sandboxed iframe sends; it names no host to allow.
        expect(hostnameOf("null")).toBe("null");
    });
});

describe("resolveAllowedHosts", () => {
    it("allows loopback with nothing configured", () => {
        const allowed = resolveAllowedHosts({});
        expect(allowed.any).toBe(false);
        if (allowed.any) return;
        expect(allowed.hostnames).toEqual(new Set(["localhost", "127.0.0.1", "::1"]));
    });

    it("adds configured hostnames rather than replacing the defaults", () => {
        const allowed = resolveAllowedHosts({ MCP_ALLOWED_HOSTS: "mcp.example.com, 10.0.0.5:3001" });
        if (allowed.any) throw new Error("expected a hostname set");
        expect(allowed.hostnames.has("mcp.example.com")).toBe(true);
        expect(allowed.hostnames.has("10.0.0.5")).toBe(true);
        // The container health check and a local client must keep working.
        expect(allowed.hostnames.has("localhost")).toBe(true);
    });

    it("takes the check off for '*'", () => {
        expect(resolveAllowedHosts({ MCP_ALLOWED_HOSTS: "*" }).any).toBe(true);
    });
});

describe("checkRequestHost", () => {
    const allowed = resolveAllowedHosts({});

    it("allows the addresses a local client actually uses", () => {
        expect(checkRequestHost({ host: "localhost:3001" }, allowed).ok).toBe(true);
        expect(checkRequestHost({ host: "127.0.0.1:3001" }, allowed).ok).toBe(true);
        expect(checkRequestHost({ host: "[::1]:3001" }, allowed).ok).toBe(true);
    });

    it("allows a Docker port mapping, where the published port is not the container's", () => {
        expect(checkRequestHost({ host: "localhost:4001" }, allowed).ok).toBe(true);
    });

    it("refuses the rebound Host a DNS-rebinding attack cannot forge away", () => {
        const check = checkRequestHost({ host: "attacker.example" }, allowed);
        expect(check.ok).toBe(false);
        if (check.ok) return;
        expect(check.header).toBe("Host");
        expect(check.reason).toContain("MCP_ALLOWED_HOSTS");
    });

    it("refuses a cross-site Origin even when the Host is right", () => {
        const check = checkRequestHost(
            { host: "localhost:3001", origin: "https://attacker.example" },
            allowed
        );
        expect(check.ok).toBe(false);
        if (check.ok) return;
        expect(check.header).toBe("Origin");
    });

    it("allows a client that sends neither header, which no browser can be", () => {
        expect(checkRequestHost({}, allowed).ok).toBe(true);
    });

    it("allows a hostname the operator named", () => {
        const configured = resolveAllowedHosts({ MCP_ALLOWED_HOSTS: "mcp.example.com" });
        expect(checkRequestHost(
            { host: "mcp.example.com", origin: "https://mcp.example.com" },
            configured
        ).ok).toBe(true);
    });

    it("allows anything once the operator opts out", () => {
        const off = resolveAllowedHosts({ MCP_ALLOWED_HOSTS: "*" });
        expect(checkRequestHost(
            { host: "attacker.example", origin: "https://attacker.example" },
            off
        ).ok).toBe(true);
    });
});
