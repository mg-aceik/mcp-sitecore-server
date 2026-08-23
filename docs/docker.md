# Docker images

- [`antonytm/mcp-sitecore-linux`](https://hub.docker.com/r/antonytm/mcp-sitecore-linux) — Linux (Node 24 Alpine)
- [`antonytm/mcp-sitecore-windows`](https://hub.docker.com/r/antonytm/mcp-sitecore-windows) — Windows (Server Core ltsc2022, Node 24)

Both images default to `TRANSPORT=streamable-http`, which listens on **port 3001** and
serves MCP at **`/mcp`**, with a `/health` liveness endpoint that the images' `HEALTHCHECK`
probes.

## Streamable HTTP

Publish the port and pass your settings as environment variables:

```shell
docker run --rm -p 3001:3001 --env-file .env antonytm/mcp-sitecore-linux:latest
```

Then point the client at `http://localhost:3001/mcp` with transport type
"Streamable HTTP". Set `AUTHORIZATION_HEADER` if the port is reachable by anything other
than your own machine.

## stdio

To use a container over stdio instead, override the transport and drop the port:

```shell
docker run --rm -i --env-file .env -e TRANSPORT=stdio antonytm/mcp-sitecore-linux:latest
```

## Building the images locally

```shell
npm run docker:linux:build
npm run docker:windows:build
```

The Dockerfiles live in [`docker/linux`](../docker/linux) and
[`docker/windows`](../docker/windows). See [Configuration](./configuration.md) for the
environment variables the images accept.
