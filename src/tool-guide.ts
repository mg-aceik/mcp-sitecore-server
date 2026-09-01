/**
 * Tool-selection guidance, written for the agent rather than for the reader of the repo.
 *
 * Several surfaces here answer the same question at very different costs, and the choice
 * has to be made *before* a tool is called — so the guidance has to reach the model
 * through the two channels it actually sees:
 *
 * - {@link ROUTING_INSTRUCTIONS} goes into the server's `initialize` instructions, which a
 *   client puts in front of the model once per session. It is deliberately short: it is
 *   paid for whether or not any of these tools are used, and it only has to be enough to
 *   stop a wrong choice and say where the rest lives.
 * - {@link TOOL_SELECTION_GUIDE} is served as the `guide://tool-selection` resource, which
 *   costs nothing until something reads it.
 *
 * Both are string constants rather than a file read of `docs/tool-selection.md`, because
 * `package.json`'s `files` ships `dist` only — the docs directory is not in the published
 * package, so a runtime read of it would fail for every npx user while working perfectly
 * in local development. That is the bug `documentation-index.ts` had to grow a path
 * fallback for; there is no reason to reintroduce it here.
 *
 * `docs/tool-selection.md` remains the human's document: it covers TOOL_GROUPS, profiles
 * and the environment variables, none of which an agent can act on. This file covers the
 * part an agent can — which surface answers which question, and what it costs — and the
 * latency table is the same measured one, not a second estimate.
 *
 * It also discloses the other `guide://` resources. A client lists resources separately
 * from tools and an agent has no reason to go looking, so a guide nothing points at is a
 * guide nothing reaches. This resource is already the place the instructions send an agent
 * before it starts choosing, which makes it the one place a pointer to them lands in front
 * of the right decision -- the other is the description of the tool each guide is about,
 * which is where an agent already partway in meets it. The guides' own text stays in
 * `src/guides/`; what is here is their URIs and when to reach for them.
 */

/**
 * The routing block appended to the server's instructions.
 *
 * Keep this short enough that its cost is never worth reconsidering. Anything needing a
 * paragraph belongs in the guide resource below.
 */
export const ROUTING_INSTRUCTIONS =
    `Several tool families here read the same Sitecore content at very different costs, so `
    + `choose the surface before the tool:\n`
    + `- One item: item-service-get-item is the fastest read (~41ms, about half of either `
    + `GraphQL endpoint).\n`
    + `- Many items or many fields: one authoring-graphql or query-graphql-<schema> query `
    + `beats N item-service calls, so the per-call advantage inverts as soon as a query can `
    + `batch.\n`
    + `- A whole subtree: prefer authoring-search with a '_path' criterion, which is one `
    + `indexed query, over item-service-get-item-descendants, which issues one HTTP request `
    + `per node, sequentially.\n`
    + `- Unpublished content is always visible to the authoring-*, item-service-* and `
    + `PowerShell tools. For query-graphql-<schema> it depends on the schema: 'edge' is `
    + `published content only, 'master' reads the authoring database.\n`
    + `- Writes: the authoring-* tools are the surface Sitecore supports for authoring, and `
    + `they keep working where SPE Remoting and the Item Service are switched off.\n`
    + `Read the guide://tool-selection resource before any bulk or repeated read: it gives `
    + `the costs, the limits and the alternatives in full.`;

/** The full guidance, served as the `guide://tool-selection` resource. */
export const TOOL_SELECTION_GUIDE = `# Choosing a Sitecore tool

Four surfaces reach the same Sitecore instance. They differ in speed, in what they can see,
and in what they need switched on. Picking the wrong one is rarely an error — it is usually
just slow, or silently missing content.

## Three tasks have a guide; read it before choosing tools

Three procedures are served as \`guide://\` resources, listed separately from
\`tools/list\` — so they are easy to have and never notice. Each is a sequence several
tools have to be run in the right order to satisfy, and the order is not recoverable from
their schemas. None costs anything until you read it, and each can be re-read at the point
the question comes up, which is usually several calls in rather than at the start.

- **\`guide://compose-page\`** — adding a component to a page. Placeholder allow-lists,
  runtime placeholder paths, dynamic placeholder IDs, SXA containers and splitters, and
  grid parameters. Every one of them has a way of producing a page that saves, renders,
  and is wrong, so read this before composing rather than after — and again mid-build when
  you meet a splitter or have to set \`GridParameters\`.
- **\`guide://bulk-update\`** — the same change across many items. The safe script
  pattern for \`run-powershell-script\`: resolve every ID from the instance, filter to the
  items that actually need the change, dry-run and show the list, get a yes, then edit
  inside BeginEdit/EndEdit with a per-item try/catch and a summary. Reach for it whenever a
  request says "all", "every" or "each" about items.
- **\`guide://diagnose-connection\`** — a tool returned an error. Maps failure signatures
  to causes, including the three that mean the opposite of how they read: the Authoring API
  answers an unauthorized call with HTTP 200, SPE answers an unauthenticated one with a
  400 and an identity provider's HTML page, and the Item Service's 403 has two causes that
  need separating before either can be fixed.

## The surfaces

| Prefix | Transport | Sees unpublished | Needs |
| --- | --- | --- | --- |
| \`item-service-*\` | REST, session cookie | yes (master) | Item Service enabled |
| \`authoring-*\` | Authoring and Management GraphQL | yes (master) | endpoint + token |
| \`query-graphql-<schema>\`, \`introspection-graphql-<schema>\` | the CM's GraphQL schemas | **depends on the schema** | API key |
| SPE — see below | SPE Remoting | yes | SPE Remoting enabled |

**The GraphQL tools are one pair per configured schema**, named after it — with the usual
configuration that is \`query-graphql-edge\` and \`query-graphql-master\`, each with a matching
\`introspection-graphql-*\`. Which content they see is the schema's, not the tool's:
\`edge\` serves published content only, so unpublished master changes are invisible to it,
while \`master\` and the preview schemas read the authoring database. Call the introspection
tool once per schema, never per query — the SDL runs past 100,000 characters.

**Which tools are SPE.** Most carry a prefix: \`common-*\`, \`provider-*\`, \`presentation-*\`,
\`security-*\`, \`indexing-*\`, \`logging-*\`, plus \`run-powershell-script\` and
\`get-powershell-documentation\`. The site, composition and media tools carry no prefix and
are the easy ones to mistake for another surface — every one of these also needs SPE
Remoting: \`list-sites\`, \`get-site-information\`, \`get-pages-by-site\`, \`search-site-pages\`,
\`list-site-components\`, \`list-insert-options\`, \`get-allowed-components-by-placeholder\`,
\`create-component-datasource\`, \`add-rendering-to-placeholder\`, \`media-upload\`,
\`media-download\`. The two \`media-*\` tools need SPE's \`mediaUpload\` / \`mediaDownload\`
services switched on as well, which is a separate setting from Remoting itself.

On a hardened SitecoreAI environment the Item Service and SPE Remoting are commonly off and
\`authoring-*\` is what remains. It is also the surface Sitecore supports for authoring
writes, and the only one that can express some operations at all — building a template with
its sections and fields in a single call, for instance.

## Read latency

Measured against a SitecoreAI dev CM: same item, warm connections, auth excluded, five
reads each.

| Surface | median | spread |
| --- | --- | --- |
| Item Service (REST) | 41 ms | 39–41 ms |
| Edge GraphQL | 85 ms | 82–106 ms |
| Authoring GraphQL | 107 ms | 87–124 ms |

That ranking holds for **single-item reads only**. One GraphQL query fetching many items or
many fields beats N Item Service round trips, so the advantage inverts as soon as a query
can batch. First use differs too: the Item Service logs in once per session with a cookie,
while the authoring tools pay an extra round trip to mint a bearer token.

## Same job, two surfaces

Where more than one family does the same job, these are the differences that decide it.
Everything not listed here exists on one surface only — all of \`security-*\`, workflow,
clones, item versions, base templates, the index lifecycle tools and \`logging-get-logs\` are
SPE alone, and there is no choice to make.

| Job | Prefer | Instead of | Why |
| --- | --- | --- | --- |
| Publish | \`authoring-publish-item\` + \`authoring-publishing-status\` | \`common-publish-item\` | The authoring pair publishes many roots, languages and targets in one call and hands back an operationId you can poll; both are asynchronous, but only the authoring one lets you find out whether the job finished. \`common-publish-item\` is the simpler single-item call and needs SPE. |
| Read a template | \`authoring-get-item-template\` | \`common-get-item-template\` | The authoring read returns sections and fields with their IDs, which is what \`authoring-create-item\` and \`authoring-update-item-template\` need. The SPE one returns the template item, not its structure. |
| Create or change a template | \`authoring-create-item-template\` / \`authoring-update-item-template\` | \`common-set-item-template\`, \`common-set-base-template\` | The authoring tools build a template with its sections and fields in one call. The SPE tools only assign a template or edit the base list. |
| Media | \`authoring-upload-media\` / \`authoring-get-media-item\` | \`media-upload\` / \`media-download\` | Both work; they need different things switched on. Authoring uploads need the CM's \`GraphQL.UploadMediaOptions.EncryptionKey\` set, the SPE ones need the \`mediaUpload\`/\`mediaDownload\` services. \`media-download\` is the only one that fetches a blob back. |
| List sites | \`authoring-list-sites\` | \`list-sites\` | Same definitions, no SPE needed, and it returns the root item ID that \`authoring-search\`'s \`_path\` criterion wants. Use \`get-site-information\` when you specifically need the composition paths (placeholder settings root, available renderings root, data folder). |
| Jobs | \`authoring-get-job\` / \`authoring-list-jobs\` | \`common-get-sitecore-job\` | The authoring pair can list and wildcard-match jobs, so you can find one whose exact name you do not know. |
| Search the index | \`authoring-search\` | \`indexing-find-item\`, \`item-service-search-items\` | \`authoring-search\` scopes to a subtree with \`_path\` and pages with a real total, and needs no SPE -- prefer it wherever the authoring API is configured. \`indexing-find-item\` needs SPE remoting and still has no total (Content Search reports none), though it now returns \`HasMore\` so paging is at least answerable; reach for it when you need a named index the other surfaces cannot address. \`item-service-search-items\` is a term search with no subtree scoping at all. For published content, a \`search\` query through \`query-graphql-<schema>\` is cheaper than any of them. |
| Create, edit or delete an item | \`authoring-create-item\` / \`-update-item\` / \`-delete-item\` | \`item-service-create-item\` / \`-edit-item\` / \`-delete-item\` | The authoring tools are the surface Sitecore supports for authoring writes and keep working where the Item Service is off. The Item Service equivalents are fine when it is on and the write is simple. |

## Reading a subtree

This is where the cost difference is largest, so it is worth stating plainly.

\`item-service-get-item-descendants\` walks the tree client-side: **one HTTP request per
node, issued sequentially**, capped at \`DESCENDANTS_MAX_ITEMS\` (5000 by default) with a
truncation notice. At the 41 ms median that is roughly 10 seconds for a 234-item subtree,
and minutes at the cap. It returns every field of every node, unpaged, which is usually a
bigger problem for the context window than the latency is for the clock.

Cheaper ways to ask the same question:

| What you want | Use | Cost |
| --- | --- | --- |
| Structure, paths, templates — at any depth | \`authoring-search\`, criterion \`_path\` = the ancestor's ID (lowercase, unpunctuated) | one query per page; identity fields only, index-backed |
| The top few levels **with** field values | \`authoring-graphql\` with nested \`children { nodes { ... } }\` | one query, but see the depth cap below |
| Anything, projected server-side | \`run-powershell-script\` with \`Get-ChildItem -Recurse\` | one round trip; needs SPE Remoting |
| The pages of a site | \`get-pages-by-site\` or \`search-site-pages\` | one round trip; decides what a page is by presentation, not template name |

Reach for \`item-service-get-item-descendants\` when the subtree is small **and** you need
every field of every node **and** the index cannot be trusted. Otherwise one of the above is
both faster and smaller.

## Limits worth knowing before writing a query

- **Authoring GraphQL rejects any document deeper than 13 levels.** A nested
  \`children { nodes { ... } }\` costs about three levels per generation, so a single query
  reaches roughly four generations. Unbounded-depth traversal is not expressible.
- **\`authoring-get-item\` returns \`hasChildren\`, not \`children\`.** Reading a tree needs the
  \`authoring-graphql\` escape hatch.
- **Template paths are relative to \`/sitecore/templates\`, with no leading slash** — the form
  the API calls \`fullName\`. An absolute path is rejected as a template that does not exist.
- **Index-backed tools reflect the index, not the database.** Straight after a write, an
  \`authoring-search\` or \`indexing-find-item\` result can lag until the index catches up.
- **Sitecore query (\`provider-get-item\` with \`query\`) is capped** by the CM's
  \`Query.MaxItems\` setting, 100 by default. That is a quiet truncation, not an error.
- **\`item-service-search-items\` is a term search with no subtree scoping.** It is not a
  substitute for any of the above.

## Composition vs. presentation

\`presentation-*\` writes the layout it is told to write, including an invalid one. The
composition tools (\`get-allowed-components-by-placeholder\`, \`create-component-datasource\`,
\`add-rendering-to-placeholder\`) read placeholder settings, datasource locations and the
available renderings in order to *refuse* an invalid layout. When authoring a page, use the
composition tools; when inspecting structure, \`presentation-get-layout\` is the cheaper read.
\`guide://compose-page\` is the order to run them in, and the placeholder and
grid detail that decides whether the result is valid.

## Escape hatches

When no typed tool fits: \`authoring-graphql\` reaches the entire Authoring and Management
schema — workflow, archiving, rules, security, languages, databases, site creation — and
\`authoring-introspect-schema\` describes it, filtered, because the SDL runs past 100,000
characters. \`run-powershell-script\` can do anything the CM can, and is the least portable.
`;
