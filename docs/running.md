# Running the server

Three ways to run it. All of them read the same settings — see
[Configuration](./configuration.md) — and all of them need a Sitecore instance prepared as
described in [Preparing your Sitecore instance](./sitecore-setup.md).

## From npm, launched by your MCP client

The usual setup. The client starts the server over stdio and manages its lifetime; you
never run a command yourself. See
[Adding the server to your MCP client](../README.md#adding-the-server-to-your-mcp-client)
for the JSON entry.

To run the published package by hand — useful for checking that credentials work before a
client is involved:

```shell
npx @antonytm/mcp-sitecore-server@latest
```

It defaults to stdio and waits for JSON-RPC on standard input, which looks like a hang; it
isn't. `Ctrl+C` to stop.

## In a container

```shell
docker run --rm -p 3001:3001 --env-file .env antonytm/mcp-sitecore-linux:latest
```

The images default to Streamable HTTP on port 3001 at `/mcp`. See
[Docker images](./docker.md) for the Windows image, running over stdio, and building the
images locally.

## From source

Requires the latest Node.js LTS release.

1. Clone the repository.
2. Run `npm install` to install dependencies.
3. Copy [`.env.template`](../.env.template) to `.env` and point it at your Sitecore
   instance.
4. Run `npm run build` to build the project.
5. Start it:

```shell
npm start           # Streamable HTTP on port 3001 at /mcp
npm run start:stdio # stdio
```

Both scripts build first, so step 4 is only needed if you want to build without starting.

Point an MCP client at `http://localhost:3001/mcp` with transport type "Streamable HTTP",
or use `npm run inspector` to drive the stdio server from the MCP Inspector. See
[CONTRIBUTING](../CONTRIBUTING.md#debugging) for the full debugging setup.

## Transports

| Transport         | How to select it                       | Endpoint                                    |
| ----------------- | -------------------------------------- | ------------------------------------------- |
| stdio             | `TRANSPORT=stdio` (the default)        | standard input/output                       |
| Streamable HTTP   | `TRANSPORT=streamable-http`            | `http://<host>:3001/mcp`, health at `/health` |

There is no SSE transport — it was removed from the MCP specification and from the SDK.
`TRANSPORT=sse` starts a Streamable HTTP server and says so on stderr, so repoint any
client still configured for `/sse` at `/mcp`.

Streamable HTTP binds `127.0.0.1` by default, so the port is not published to the network
until you set `HOST`. Set `AUTHORIZATION_HEADER` whenever you do. Requests are also refused
unless their `Host` and `Origin` name somewhere this server is served from, which stops a
browser being rebound onto the port; a deployment reached by a name of its own lists it in
`MCP_ALLOWED_HOSTS`. See [Configuration](./configuration.md#dns-rebinding).
