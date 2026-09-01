# Guides

The server registers three `guide://` [MCP resources](https://modelcontextprotocol.io/specification/2026-07-28/server/resources)
— procedures several tools have to be run in the right order to satisfy, where the order
is not recoverable from their schemas. They carry the guidance the tools can act on but do
not encode: a resource costs nothing until it is read, unlike the server `instructions`,
which are paid every session, so this is where task-specific knowledge belongs.

All three are defined in [`src/guides/`](../src/guides/) and registered by
[`registerGuides`](../src/guides/register-guides.ts).

| Resource | Body | Offered when |
| --- | --- | --- |
| `guide://compose-page` | `COMPOSE_PAGE_GUIDE` | `powershell.composition` and `add-rendering-to-placeholder` are enabled |
| `guide://bulk-update` | `BULK_UPDATE_GUIDE` | `powershell.core` and `run-powershell-script` are enabled |
| `guide://diagnose-connection` | `DIAGNOSE_CONNECTION_GUIDE` | always |

(`guide://tool-selection` is a fourth, and a different thing: it is the routing document,
covered in [Tool selection](./tool-selection.md).)

They share one term deliberately: **ground truth** — a value read back from this instance
rather than derived, recalled or inferred from a name. It is the same failure in all three
(a placeholder path, a GUID, an error signature taken on faith), so each guide defines the
term once and then uses the bare phrase. Keep the wording identical when editing one.

## Why resources and not prompts

These were also registered as MCP prompts, taking one free-text `request` argument, and
that half is gone. The server no longer advertises the prompts capability.

A prompt is user-triggered and one-shot. Somebody has to know it exists, pick it *before*
the first tool call, and once injected it cannot be consulted again — while the failures
these bodies guard against surface **mid-task**, several calls in, when an agent meets a
Column Splitter, has to put a value in `GridParameters`, or gets a 400 with an HTML body
back from SPE. A resource fits that shape: readable at the moment the question arises,
re-readable, and reachable by an agent that would never have gone looking through a prompt
list. The argument was carrying nothing either — the request is already in the agent's
context, in the user's own message, in full — and a slash-command client that splits one
string across declared arguments could turn prose into `page: "create"`, which then read as
a confident instruction.

What a prompt did buy was **discovery**: a client puts a slash command in front of the
user. A resource has to be named somewhere the agent already reads, so three places do it:

- [`guide://tool-selection`](../src/tool-guide.ts), where the server's `initialize`
  instructions send an agent before it chooses a surface. It lists each guide URI and when
  to reach for it.
- **`add-rendering-to-placeholder`'s own description**, which names `guide://compose-page`.
- **`run-powershell-script`'s own description**, which names `guide://bulk-update`.

The last two are the pointers that land in time: they are the tools an agent is already
reading at the moment the guide becomes relevant. Renaming a guide URI means fixing those
descriptions too — a unit test asserts both.

## `guide://compose-page`

Adding a component to a page correctly, written for an agent that has the composition
tools but not the Sitecore knowledge that makes them safe to use in sequence. The tools
each refuse what they can detect; what they cannot do is stop the caller getting the
*order* wrong, inventing a placeholder path, or guessing a `GridParameters` value — and
every one of those produces a page that saves, renders, and is wrong.

The guidance it carries covers:

- the seven-step order (resolve the site → find the rendering → read the current layout →
  check the placeholder allow-list → create and fill the datasource → add the rendering →
  verify), and why skipping ahead fails invisibly;
- filling the datasource's text fields before moving on — `create-component-datasource`
  sets only the fields it is given, so a component added and left alone renders blank and
  reads as a failed deployment. Placeholder copy that names the component beats nothing;
  image and link fields stay empty, since those need a real ID;
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

It is only offered when the workflow it describes can actually run: gated on the
`powershell.composition` group and the `add-rendering-to-placeholder` tool being enabled
(see [Tool selection](./tool-selection.md)). A procedure whose every step names an absent
tool is not a useful document, it is a misleading one.

## `guide://bulk-update`

Applying the same change across many items with a `run-powershell-script` script,
following the pattern Sitecore developers use for one-off bulk updates: a configuration
block whose every GUID was resolved from the instance rather than guessed, pre-flight
checks, a collect-then-filter pass that targets only the items that *need* the change (so
reruns are idempotent), a dry run whose output the user approves before anything is
written, an edit loop bracketed in `BeginEdit`/`EndEdit` with a per-item `try`/`catch`,
and a final summary of counts and errors.

Two things it requires before step 1, and neither is ever inferred: the subtree to run
under, because a bulk write is never run unrooted, and which items under it qualify. Both
are established with the user — a root or a filter the agent guessed at is the one mistake
here that cannot be walked back.

The rest of the guidance covers the mistakes that make bulk scripts dangerous: running the
dry run and the real run as one execution, guessing GUIDs, comparing templates by name,
matching un-normalised GUIDs against raw layout XML, copying standard-values text when
`.Reset()` (which restores inheritance) was what was meant, forgetting that versioned and
language fields update one version at a time, and emitting ISE-only output
(`Write-Progress`, colors) over SPE Remoting. It also caps dry-run listings, batches large
trees, and leaves publishing as a separate, explicit decision.

It is gated on the `powershell.core` group and the `run-powershell-script` tool being
enabled — without that tool the procedure has nothing to execute on.

## `guide://diagnose-connection`

Works out which of the server's four Sitecore surfaces — the Authoring and Management
API, the Item Service, GraphQL Edge and SPE Remoting — can reach the instance, and
diagnoses the ones that cannot from their failure signatures. The four APIs fail
*separately* — a working Item Service says nothing about SPE Remoting — and several of
the failures are misleading on their face: SPE answers an unauthenticated call from a
Cloud-federated CM with a 400 and an identity provider's HTML page, and the Authoring API
answers an unauthorized call with an HTTP 200.

It gives the cheapest probe for each surface (starting with `config`, which reports what is
configured with the secrets redacted), then maps the exact error text back to the setting
or environment variable at fault. The same knowledge in long form, written for a person
setting the instance up, is in [Preparing your Sitecore instance](./sitecore-setup.md).

This one is never gated: which surfaces are absent is the question it answers, so a partly
disabled server is the case it is most wanted in. When a surface is deliberately disabled
via `TOOL_PROFILE`, the diagnosis says so rather than calling it broken.
