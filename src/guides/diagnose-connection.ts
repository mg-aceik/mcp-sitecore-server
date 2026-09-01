/**
 * "Which of the four surfaces actually work against this instance, and why not?"
 *
 * This server talks to four independent APIs, each with its own credentials, its own
 * enablement switches and its own way of failing. They fail *separately* — a working
 * Item Service says nothing about SPE Remoting — and several of the failures are
 * misleading on their face: SPE answers an unauthenticated call with a 400 and an HTML
 * page from an identity provider, and the Authoring API answers an unauthorized call with
 * an HTTP 200.
 *
 * The knowledge is already written down in `docs/sitecore-setup.md`, which an agent never
 * reads. The signature table below is the part it needs, condensed to the mapping from
 * what a tool returns to what is actually wrong.
 */

/** Served as the `guide://diagnose-connection` resource. */
export const DIAGNOSE_CONNECTION_GUIDE = `
## What to probe

Four independent APIs, four sets of credentials, four enablement switches. They fail
separately — a working Item Service tells you nothing about SPE. Probe each with its
cheapest read and record the exact error text; the wording is the diagnosis.

| Surface | Cheapest probe | Needs |
| --- | --- | --- |
| Configuration | \`config\` | nothing — start here |
| Authoring and Management API | \`authoring-list-sites\` | endpoint + bearer token |
| Item Service | \`item-service-get-item\` on \`/sitecore/content\` | Item Service enabled + account |
| GraphQL Edge / master | \`introspection-graphql-<schema>\` (no arguments) | API key |
| SPE Remoting | \`security-get-current-user\` | SPE Remoting enabled + account |

Start with \`config\`. It reports which endpoints and accounts are configured with the
secrets redacted, and an empty value there explains a failure without a round trip.

**You are done when every surface in scope has a verdict line** — reachable, misconfigured,
or deliberately disabled — so a failure on the first surface is a result to record and
carry on from, not a stopping point. Which surfaces work is what determines what the user
can actually do next. A surface switched off on purpose gets the "deliberately disabled"
verdict: \`TOOL_PROFILE\` has \`no-spe\`, \`no-item-service\`, \`no-edge-graphql\` and
\`no-authoring-api\` for exactly that.

## Failure signatures

The exact error text is the ground truth here — match a signature against what came back,
and let it overrule what you expected the surface to do.

**Authoring and Management API**
- *"needs a bearer token, and none is configured"* — neither \`AUTHORING_CLIENT_ID\` +
  \`AUTHORING_CLIENT_SECRET\` nor \`AUTHORING_TOKEN\` is set.
- *\`AUTH_NOT_AUTHENTICATED\` on an HTTP 200* — reachable, but the token is missing,
  expired, or issued for a different audience or environment.
  **An HTTP 200 is not a success on this API** — the errors array is where the truth is.
- *404* — \`GraphQL.Enabled\` is not \`true\`, or \`AUTHORING_ENDPOINT\` points somewhere
  other than the CM.
- *Token endpoint returns \`access_denied\`* — the automation client lacks the
  \`xmcloud.cm:admin\` scope, or \`AUTHORING_AUDIENCE\` is wrong.

**Item Service**
- *Every \`item-service-*\` tool returns 403* — two causes that look identical. Either the
  account is not valid here, or \`Sitecore.Services.SecurityPolicy\` is still
  \`ServicesOffPolicy\`. Tell them apart: POST malformed JSON to
  \`/sitecore/api/ssc/auth/login\`. A 400 or 500 means the endpoint is live and the
  credentials are being refused; 403 for *every* body means the policy is off.
- *Login works over HTTPS, fails over HTTP* — \`Sitecore.Services.AllowToLoginWithHttp\`
  is not \`true\`. Prefer fixing the URL over changing the setting.

**SPE Remoting**
- *HTML (a login page) instead of CliXml* — the \`RequireAuthentication\` ignore rule is
  missing, or the config did not patch after SPE's own.
- *403* — \`remoting\` is not \`enabled="true"\`, or the account is in none of the
  authorized roles.
- *400 with an HTML page and an \`x-auth0-requestid\` header* — the request never reached
  Sitecore. A CM federated to Sitecore Cloud redirects an unauthenticated remoting call to
  the identity provider, which answers with its own error page; HTTP Basic credentials
  cannot satisfy it. This is **not** a disabled \`remoting\` service, and diagnosing it as
  one sends people down the wrong path. A burst of these becomes 429.

**Any surface**
- *\`self signed certificate\` / \`unable to verify the first certificate\`* — a local CM
  with a self-signed certificate. \`.env.template\` ships
  \`NODE_TLS_REJECT_UNAUTHORIZED=0\` for local work only; it must never be carried to a
  shared environment.

## Reporting

Give a line per surface — reachable, misconfigured, or deliberately disabled — then the
diagnosis for each failure and the single most likely fix, naming the setting or
environment variable. Point at \`/sitecore/admin/showconfig.aspx\` when the answer depends
on whether a config patch merged.

Refer to every credential by its variable name — \`AUTHORING_CLIENT_SECRET\`, not its
value. \`config\` returns secrets redacted; keep them that way and never print a secret.
`;
