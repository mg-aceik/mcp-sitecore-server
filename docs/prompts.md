# Prompts

The server registers three [MCP prompts](https://modelcontextprotocol.io/specification/2026-07-28/server/prompts)
— user-invokable workflows that clients surface as slash commands or prompt pickers. They
carry the guidance the tools can act on but do not encode: a prompt costs nothing until a
user picks one, unlike the server `instructions`, which are paid every session, so this is
where task-specific knowledge belongs.

All three are defined in [`src/prompts/`](../src/prompts/), and each takes arguments a
client fills in before sending.

## `add-component-to-page`

Adds a component to a page correctly, written for an agent that has the composition tools
but not the Sitecore knowledge that makes them safe to use in sequence. The tools each
refuse what they can detect; what they cannot do is stop the caller getting the *order*
wrong, inventing a placeholder path, or guessing a `GridParameters` value — and every one
of those produces a page that saves, renders, and is wrong.

| Argument | Required | Meaning |
| --- | --- | --- |
| `page` | yes | Full Sitecore path or item GUID of the page. |
| `component` | yes | Rendering name, e.g. `RichText`, `Container`, `Column Splitter`. |
| `placeholder` | no | Target placeholder: a full runtime path or a bare key. Omit to have the page's current layout read and a real placeholder chosen from it. |
| `site` | no | Site name, when the page path alone does not make it obvious. |

The guidance it carries covers:

- the seven-step order (resolve the site → find the rendering → read the current layout →
  check the placeholder allow-list → create the datasource → add the rendering → verify),
  and why skipping ahead fails invisibly;
- placeholder paths versus placeholder keys — the layout stores the full runtime path, and
  each `-<n>` suffix is a `DynamicPlaceholderId` that must be read off the instance, never
  invented;
- building nested structure from `ChildPlaceholder` on each add result, and why `null`
  there is a correct answer rather than a failure;
- the SXA Container and Column/Row Splitter cases — a splitter exposes one placeholder per
  column, named per column and not after the rendering, so the naming has to be
  established from a page that already uses one;
- `GridParameters` and `FieldNames` as item references, not class strings — the server
  never invents a value for them, and neither should the agent.

The prompt is only offered when the workflow it describes can actually run: it is gated on
the `powershell.composition` group and the `add-rendering-to-placeholder` tool being
enabled (see [Tool selection](./tool-selection.md)). Offering it on a server whose
composition tools were withheld would advertise a workflow whose first call does not
exist.

## `bulk-update-items`

Applies the same change across many items with a `run-powershell-script` script, following
the pattern Sitecore developers use for one-off bulk updates: a configuration block whose
every GUID was resolved from the instance rather than guessed, pre-flight checks, a
collect-then-filter pass that targets only the items that *need* the change (so reruns are
idempotent), a dry run whose output the user approves before anything is written, an edit
loop bracketed in `BeginEdit`/`EndEdit` with a per-item `try`/`catch`, and a final summary
of counts and errors.

| Argument | Required | Meaning |
| --- | --- | --- |
| `change` | yes | The change to make to each matching item, e.g. "reset `__Final Renderings` to the template default". |
| `rootPath` | yes | The subtree to update under, as a full content path. Bulk writes are never run unrooted. |
| `criteria` | no | Which items qualify, e.g. a template plus a field condition. Omit to establish it with the user first. |

The guidance it carries covers the mistakes that make bulk scripts dangerous: running the
dry run and the real run as one execution, guessing GUIDs, comparing templates by name,
matching un-normalised GUIDs against raw layout XML, copying standard-values text when
`.Reset()` (which restores inheritance) was what was meant, forgetting that versioned and
language fields update one version at a time, and emitting ISE-only output
(`Write-Progress`, colors) over SPE Remoting. It also caps dry-run listings, batches large
trees, and leaves publishing as a separate, explicit decision.

It is gated on the `powershell.core` group and the `run-powershell-script` tool being
enabled — without that tool the procedure has nothing to execute on.

## `diagnose-connection`

Works out which of the server's four Sitecore surfaces — the Authoring and Management
API, the Item Service, GraphQL Edge and SPE Remoting — can reach the instance, and
diagnoses the ones that cannot from their failure signatures. The four APIs fail
*separately* — a working Item Service says nothing about SPE Remoting — and several of
the failures are misleading on their face: SPE answers an unauthenticated call from a
Cloud-federated CM with a 400 and an identity provider's HTML page, and the Authoring API
answers an unauthorized call with an HTTP 200.

| Argument | Required | Meaning |
| --- | --- | --- |
| `surface` | no | Limit the check to one surface: `authoring`, `item-service`, `graphql` or `powershell`. Omit to check all four. |
| `symptom` | no | What went wrong, if something specific prompted this — the exact error text is most useful. |

It tells the agent the cheapest probe for each surface (starting with `config`, which
reports what is configured with the secrets redacted), then maps the exact error text back
to the setting or environment variable at fault. The same knowledge in long form, written
for a person setting the instance up, is in
[Preparing your Sitecore instance](./sitecore-setup.md).

This prompt is never gated: which surfaces are absent is the question it answers, so a
partly disabled server is the case it is most wanted in. When a surface is deliberately
disabled via `TOOL_PROFILE`, the diagnosis says so rather than calling it broken.
