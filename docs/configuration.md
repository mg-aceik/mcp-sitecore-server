# Configuration

Every setting is an environment variable. In an MCP client they go in the server entry's
`env` map; running locally or in Docker they come from a `.env` file — copy
[`.env.template`](../.env.template) to `.env` and fill it in.

The endpoints below assume the Sitecore side is already enabled. See
[Preparing your Sitecore instance](./sitecore-setup.md) for the SPE Remoting and Item
Service configuration these settings talk to.

## Transport

| Variable    | Default | Description                                                                                                                                                                                                                    |
| ----------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `TRANSPORT` | `stdio` | `stdio` or `streamable-http`. Streamable HTTP serves MCP at `/mcp`, with a `/health` liveness endpoint. An unrecognised value falls back to `stdio` and says so on stderr. `sse` is gone — see [SSE removal](#sse-removal) below. |
| `PORT`      | `3001`  | Port the Streamable HTTP transport listens on. Ignored on stdio.                                                                                                                                                                 |
| `HOST`      | all interfaces | Interface to bind. Set it to `127.0.0.1` to keep the port off the network.                                                                                                                                            |
| `MCP_BODY_LIMIT` | `32mb` | Maximum request body the `/mcp` endpoint accepts. Express's own default of 100kb is smaller than a single base64 image, so `media-upload`'s inline `content` needs the headroom.                                       |

### SSE removal

The SSE transport was removed from the MCP specification and from the SDK, so
`http://<host>:3001/sse` and its companion `/messages` endpoint no longer exist. Setting
`TRANSPORT=sse` still starts a server — Streamable HTTP on port 3001 at `/mcp` — and says
so on stderr, so a container keeps listening while you repoint its clients. Change the
client's URL to `http://<host>:3001/mcp` and its transport type to "Streamable HTTP".

## Sitecore endpoints

| Variable                  | Default    | Description                                                       |
| ------------------------- | ---------- | ----------------------------------------------------------------- |
| `GRAPHQL_ENDPOINT`        | —          | The GraphQL endpoint URL for the Sitecore instance.               |
| `GRAPHQL_SCHEMAS`         | —          | The Sitecore schemas to use for the GraphQL API, comma-separated. |
| `GRAPHQL_API_KEY`         | —          | The API key for the GraphQL endpoint, sent as an HTTP header.     |
| `GRAPHQL_HEADERS`         | —          | Additional headers to include in the GraphQL requests.            |
| `ITEM_SERVICE_SERVER_URL` | —          | The base URL for the Item Service API.                            |
| `ITEM_SERVICE_DOMAIN`     | `sitecore` | The domain for Item Service API authentication.                   |
| `ITEM_SERVICE_USERNAME`   | —          | The username for Item Service API authentication.                 |
| `ITEM_SERVICE_PASSWORD`   | —          | The password for Item Service API authentication.                 |
| `POWERSHELL_SERVER_URL`   | —          | The base URL for the Sitecore PowerShell Remoting API.            |
| `POWERSHELL_DOMAIN`       | `sitecore` | The domain for PowerShell Remoting API authentication.            |
| `POWERSHELL_USERNAME`     | —          | The username for PowerShell Remoting API authentication.          |
| `POWERSHELL_PASSWORD`     | —          | The password for PowerShell Remoting API authentication.          |

## Tool surface

All three are unset by default, which registers every tool. See
[Tool selection](./tool-selection.md) for the full treatment.

| Variable         | Default | Description                                                                            |
| ---------------- | ------- | -------------------------------------------------------------------------------------- |
| `TOOL_GROUPS`    | —       | Comma-separated allowlist of tool groups to register. Unset registers every group.     |
| `DISABLED_TOOLS` | —       | Comma-separated list of exact tool names to leave unregistered. Always wins on conflict. |
| `TOOL_PROFILE`   | `xp`    | A documented preset denylist for a platform: `xp` disables nothing, `sai` hides the CM-identity set. |

## Limits and behaviour

| Variable                 | Default              | Description                                                                                                                             |
| ------------------------ | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `POWERSHELL_TIMEOUT_MS`  | `600000` (10 min)    | Timeout for a single PowerShell Remoting request.                                                                                       |
| `POWERSHELL_FULL_ERRORS` | `false`              | `true` returns the complete .NET error record instead of the shaped summary when a command fails. Individual tools also accept `full: true` per call. |
| `REQUEST_TIMEOUT_MS`     | `30000` (30 s)       | Timeout for Item Service and GraphQL requests.                                                                                          |
| `DESCENDANTS_MAX_ITEMS`  | `5000`               | Node cap for `item-service-get-item-descendants`, which reports truncation rather than exhausting memory on a large or circular tree.   |

## Security

| Variable                       | Default | Description                                                                                                                                                                       |
| ------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AUTHORIZATION_HEADER`         | —       | If set, the server expects an `authorization` header matching this value. If unset, no authorization check is performed. Set it whenever the HTTP port is reachable by anything other than your own machine. |
| `NODE_TLS_REJECT_UNAUTHORIZED` | —       | Read by Node itself. `.env.template` ships it set to `0` so the server can talk to a local Sitecore instance with a self-signed certificate.                                      |
| `MEDIA_LOCAL_FILE_ROOT`        | —       | Directory that `media-upload`'s `filePath` and `media-download`'s `saveTo` are confined to. Required to use those parameters at all under `TRANSPORT=streamable-http`; see [Media and the local filesystem](#media-and-the-local-filesystem). |
| `MEDIA_ALLOW_PRIVATE_SOURCE_URL` | `false` | `true` lets `media-upload`'s `sourceUrl` reach private, loopback and link-local addresses. Leave it off unless you are deliberately importing from your own network.            |

> **Warning:** `NODE_TLS_REJECT_UNAUTHORIZED=0` disables TLS certificate verification for
> every outbound request. Set it to `1`, or remove it, in production or on an untrusted
> network.

### Media and the local filesystem

`media-upload` can read bytes from `filePath`, and `media-download` can write them to
`saveTo`. Both act on the machine running this MCP server, not on Sitecore.

On stdio that is unremarkable: the server is a subprocess of your own client and can
already reach anything you can. Over `TRANSPORT=streamable-http` it is not, because
`AUTHORIZATION_HEADER` is empty by default and anyone who can reach the port would get
arbitrary file read and write on the host. So both parameters are **refused** on the HTTP
transport unless `MEDIA_LOCAL_FILE_ROOT` names a directory, and when it is set every path
— on either transport — must resolve inside it.

`sourceUrl` is the other way out of the process: the server fetches it. Only `http` and
`https` are accepted, and hostnames that resolve to private, loopback or link-local
addresses (including the `169.254.169.254` cloud metadata endpoint) are refused unless
`MEDIA_ALLOW_PRIVATE_SOURCE_URL=true`.

## Resources

- `config` — returns the configuration of the server. Use it to check that everything is
  properly configured.
