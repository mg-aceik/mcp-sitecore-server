import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { getServer } from './server.js';
import { config } from './config.js';

export function startSTDIO() {
    // `serveStdio` owns the protocol-era decision for the connection: the opening
    // exchange decides whether the client speaks 2026-07-28 (no initialize, no
    // session) or the 2025 handshake, and one server from this factory is pinned for
    // the connection's lifetime either way. Both eras are served from the same
    // registrations, so a client on either revision sees the same tools.
    serveStdio(() => getServer(config), {
        onerror: (error) => console.error('MCP stdio error:', error),
    });
}
