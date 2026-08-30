import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

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

const DESCRIPTION =
    "Work out which of this server's four Sitecore surfaces (Authoring and Management API, "
    + "Item Service, GraphQL Edge, SPE Remoting) can reach the instance, and diagnose the "
    + "ones that cannot from their failure signatures.";

const GUIDANCE = `
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

Do not stop at the first failure — report on all four, because which ones work determines
what the user can actually do. If a surface is deliberately absent, say so rather than
calling it broken: \`TOOL_PROFILE\` has \`no-spe\`, \`no-item-service\`,
\`no-edge-graphql\` and \`no-authoring-api\` for exactly that.

## Failure signatures

Match on what came back, not on what you expected.

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

Never print a secret. \`config\` returns them redacted; keep it that way, and refer to
credentials by their variable name.
`;

export function diagnoseConnectionPrompt(server: McpServer) {
    server.registerPrompt(
        "diagnose-connection",
        {
            title: "Diagnose the Sitecore connection",
            description: DESCRIPTION,
            argsSchema: z.object({
                surface: z.string().optional()
                    .describe("Limit the check to one surface: 'authoring', 'item-service', 'graphql' or 'powershell'. Omit to check all four."),
                symptom: z.string().optional()
                    .describe("What went wrong, if something specific prompted this — the exact error text is most useful."),
            }),
        },
        ({ surface, symptom }) => {
            const scope = surface
                ? `Check the ${surface} surface only.`
                : `Check all four surfaces.`;
            const reported = symptom
                ? `\n\nThe reported symptom is: ${symptom}\nStart from that signature, but still confirm which surfaces work — a symptom on one surface is often caused by a setting that affects another.`
                : "";

            return {
                messages: [
                    {
                        role: "user" as const,
                        content: {
                            type: "text" as const,
                            text:
                                `Diagnose this server's connection to Sitecore. ${scope}${reported}\n\n`
                                + `Probe each surface, record the exact error text, and match it against `
                                + `the table below before drawing a conclusion — several of these failures `
                                + `are misleading on their face.\n`
                                + GUIDANCE,
                        },
                    },
                ],
            };
        }
    );
}
