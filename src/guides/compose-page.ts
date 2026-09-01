/**
 * Adding a component to a page, written for an agent that has the composition tools but
 * not the Sitecore knowledge that makes them safe to use in sequence.
 *
 * The tools each refuse what they can detect. What they cannot do is stop the caller
 * getting the *order* wrong, or inventing a placeholder path, or guessing at a
 * `GridParameters` value — and every one of those produces a page that saves, renders,
 * and is wrong. This guide is that missing half.
 *
 * The parts worth stating explicitly, because they are what people and models get wrong:
 *
 * - **A placeholder path is not a placeholder key.** The layout stores the full runtime
 *   path (`/headless-main/page-section-1/container-2`), and each `-<n>` suffix is the
 *   `DynamicPlaceholderId` of the rendering that owns that level. Composing it by hand
 *   from a key and a guessed number silently merges two placeholders.
 * - **Only the shape of that path generalises.** `Container` and the splitters are stock
 *   SXA; `PageSection` is not, and `headless-main` is a site template's choice. The
 *   sampled paths in this file and in `placeholder-settings.ts` come from one Stride
 *   instance and are illustrations, so the guide says so and sends the agent to read
 *   the real keys off the page rather than recognising names it was shown here.
 * - **`ChildPlaceholder` is the answer when it is non-null, and null is not an error.**
 *   `Get-McpChildPlaceholder` derives `<kebab-rendering-name>-<id>` and then *verifies* it
 *   against a wildcard settings item, making no claim when it cannot. That is correct for
 *   Container (`container-{*}`) and correct to decline for a Column Splitter, whose
 *   placeholders are named per column and not after the rendering at all.
 * - **Splitters are the case the derivation cannot cover.** A Column Splitter exposes one
 *   placeholder per column, so the caller has to build them — and the only trustworthy
 *   source for the naming an instance actually uses is a page that already does it.
 * - **`GridParameters` is an item reference, not a class string,** and this server
 *   deliberately never invents one (see `rendering-parameters.ts`).
 * - **An empty datasource and an empty rendering parameter are opposite cases,** which is
 *   why the guide treats them separately. `create-component-datasource` sets only the
 *   fields it is given, so a component added and left alone renders blank and reads as a
 *   failed deployment — hence step 5 requires text content, placeholder if nothing else.
 *   An empty *parameter* key is the normal state Sitecore itself writes, so the styling
 *   section still says to leave one empty rather than invent a reference for it.
 */

/**
 * Served as the `guide://compose-page` resource, and named by
 * `add-rendering-to-placeholder`'s description so an agent about to compose a page is
 * told the guide exists at the moment it matters.
 */
export const COMPOSE_PAGE_GUIDE = `
## Order

Take the steps in order: each one's output is the next one's input, and the failure this
sequence prevents is invisible — an invalid layout saves, renders, and passes every
field-level check.

Throughout, **ground truth** means a value you read back from this instance. Every
placeholder path, dynamic-placeholder number and item ID below is ground truth or it is a
guess, and a guess here produces a page that looks fine and is wrong.

1. **Resolve the site and the page.** \`list-sites\`, then \`get-pages-by-site\` if the page
   is described rather than named. Every later call needs the page by path or ID.
2. **Find the rendering.** \`list-site-components\` lists what the site makes available,
   grouped. It is an *inventory, not an allow-list* — the groups say nothing about where a
   component may be placed.
3. **Read the current layout.** \`presentation-list-renderings\` with
   \`includeParameters: true\`. This is the single most useful call in the sequence: it
   gives you the real placeholder paths on this page, the real \`DynamicPlaceholderId\`
   values, and the real parameter key names and values that this instance uses. This is
   your ground truth for everything that follows: copy a pattern you can see here rather
   than deriving one you cannot verify.
4. **Check the placeholder.** \`get-allowed-components-by-placeholder\` with the exact
   runtime path you intend to write. Read the result before continuing:
   - \`Found: false\` means no settings item governs that key. That is almost always a
     misspelled or invented placeholder path — go back to step 3 and read the real one.
     It does not mean "unrestricted".
   - \`Allowed\` not containing your rendering means the page would be structurally
     invalid. Choose a component from \`Allowed\`, or change the settings item that
     governs the placeholder — those are the two ways forward. \`force: true\` belongs to
     migration and repair work that means to write a layout the current settings forbid;
     an unexpected refusal is a wrong target, not an occasion for it.
   - \`Unresolved\` lists allowed-control IDs that resolve to no item. That is a content
     defect on their side; mention it, do not silently ignore it.
5. **Create the datasource, and give it content,** if the rendering takes one.
   \`create-component-datasource\` reads the Datasource Template and Datasource Location
   off the rendering itself. \`placement: "page-local"\` (the default) creates
   \`<page>/Data/<name>\` and returns \`DatasourceReference\` in the \`local:/Data/<name>\`
   form authored pages use; \`"shared"\` returns an item ID. Pass whichever it returns
   straight through as \`dataSource\`, character for character — it is already in the form
   the layout expects.

   **Then fill its text fields, always.** \`create-component-datasource\` creates the item
   from the template and sets only the fields you pass in \`fields\`, so a datasource you
   create and walk away from renders as an empty component — which reads as a broken
   deployment rather than a page waiting for copy. Read the field names off the new item
   with \`item-service-get-item\` (the template's own fields come back alongside the
   \`Item*\` metadata), then give **every** text field a value, through \`fields\` on the
   create or \`item-service-edit-item\` afterwards: the caller's content where they gave
   you some, otherwise placeholder copy that names the component and says it is
   placeholder, so an author can see what to replace. Leave image, link and other
   reference fields empty — those take a real media or item ID, and a fabricated one
   points at nothing.
6. **Add the rendering.** \`add-rendering-to-placeholder\`, not
   \`presentation-add-rendering\`: the latter writes whatever it is told. It validates
   against the allow-list, assigns a collision-free \`DynamicPlaceholderId\`, and writes
   the full parameter set the rendering's parameters template declares.
7. **Verify.** Re-read with \`presentation-list-renderings\` and confirm the rendering is
   on the placeholder you intended, with the parameters you intended, and re-read the
   datasource to confirm its text fields carry the content from step 5.

## Placeholder paths and dynamic placeholders

The layout stores a **full runtime path**, not a key. One instance's page, as an
illustration of the shape — not as names to expect:

    /headless-main/page-section-1/container-2

Each trailing \`-<n>\` is the \`DynamicPlaceholderId\` of the rendering that owns that
level, so \`page-section-1\` means "the rendering named PageSection whose
\`DynamicPlaceholderId\` is 1".

**Only the shape generalises.** \`PageSection\` is not an SXA rendering; it is one
solution's own component, and \`headless-main\` is a site template's choice of root
placeholder. Both differ between instances. Treat every placeholder key in this document
as an example, and take the real ones as ground truth from step 3.

- The **settings items are wildcard-keyed** — \`container-{*}\`, \`column-1-{*}\` and
  whatever this solution's own components define. Resolution matches the **leaf segment**
  against those, so you can ask \`get-allowed-components-by-placeholder\` about a bare key
  or a full path.
- \`add-rendering-to-placeholder\` needs the **exact runtime path**, because that is what
  gets written.
- **The number is ground truth.** Take it from \`ChildPlaceholder\` on the parent's add
  result, or read it off \`presentation-list-renderings\` — and never invent the number,
  because a colliding \`DynamicPlaceholderId\` silently merges two placeholders into one.
  \`dynamicPlaceholderId\` on the tool is for reproducing an exact known layout, nothing
  else.

### Building nested structure

\`add-rendering-to-placeholder\` returns \`ChildPlaceholder\`: the path a child rendering
should target. **Use it verbatim** — one call per level, each fed by the last.

\`ChildPlaceholder: null\` is not a failure. It means the tool could not *verify* a child
placeholder, so it declined to claim one. It happens when the rendering exposes no
placeholder at all, and when the placeholder it exposes is not named after it — which is
exactly the splitter case below.

## Container, splitters, and everything else

\`Container\`, \`Column Splitter\` and \`Row Splitter\` are stock SXA renderings, so the
two patterns below hold wherever SXA does. Everything else — a \`PageSection\`, a
\`Tabs\`, any component with a placeholder in its markup — is the solution's own, and
nothing about its placeholder naming can be assumed. For those, step 3 is the only
reliable source.

### Container, and anything whose placeholder is named after it

A Container's child placeholder derives cleanly (\`container-<id>\`) and is confirmed by a
\`container-{*}\` settings item, so \`ChildPlaceholder\` comes back populated. Take it and
carry on. The same holds for any rendering whose placeholder key is the kebab-cased
rendering name — the tool will have verified it before claiming it.

### Column Splitter and Row Splitter

A splitter exposes **one placeholder per column or row** — conventionally
\`column-1-<id>\`, \`column-2-<id>\`, … — not one named after the rendering. So
\`ChildPlaceholder\` will be \`null\`, correctly.

Establish the naming from the instance, in this order:

1. Find a page that already uses that splitter (\`get-pages-by-site\`, then
   \`presentation-list-renderings\` with \`includeParameters: true\`) and read the real
   child placeholder paths off it. This is ground truth for this instance.
2. Failing that, probe: take the splitter's own \`DynamicPlaceholderId\` from the add
   result, build \`<parentPlaceholder>/column-1-<id>\`, and confirm it with
   \`get-allowed-components-by-placeholder\`. \`Found: true\` means the key is real and you
   may write to it; \`Found: false\` means the probe has told you the key is fabricated, so
   try the next candidate.

**How many columns exist, and how wide, is controlled by the splitter's own rendering
parameters** — not by adding more placeholders. Read the actual key names from the
\`Parameters\` string in the add result (the tool writes the full key set the parameters
template declares) and set values through \`presentation-set-rendering-parameter\` or by
passing \`parameters\` on the add. Parameter names the template does not define are
rejected rather than written, so check the key names before assuming them.

### Grid parameters, variants and styling

The parameter set on an SXA rendering typically includes \`GridParameters\`,
\`FieldNames\`, \`Styles\`, \`CSSStyles\`, \`RenderingIdentifier\` and
\`DynamicPlaceholderId\`. Sitecore writes every key, empty where there is no value — an
empty *parameter* key is the normal, valid state, not something to fill in. (The
datasource in step 5 is the opposite case: its text fields do get content.)

- **\`GridParameters\` is an item ID**, referencing a grid class item in the site's grid
  definition. It is not a class string like \`col-12\`. This server deliberately never
  invents a value for it, because the value is editor configuration and is not readable
  off the rendering.
- To set it, get **ground truth for the ID**: read \`GridParameters\` off a comparable
  rendering on an authored page (step 3), or locate the site's grid definition items under
  the tenant/site \`Presentation\` tree with \`item-service-search-items\` or
  \`indexing-find-item\` and use the ID of the class you want. Never pass a GUID you have
  not resolved to an actual item.
- **\`FieldNames\`** is the rendering variant, also an item reference. Same rule.
- If you cannot establish a real value, leave the key empty and say so. An empty
  \`GridParameters\` renders with the component's default; a fabricated one points at
  nothing.

## Writing

- \`finalLayout\` defaults to \`true\`, which is where authored pages carry their
  renderings. Only set it \`false\` when you specifically mean the shared layout.
- \`index\` positions the rendering within the placeholder; it appends by default.
- Report what you did with the placeholder path, the \`UniqueId\` and the
  \`DynamicPlaceholderId\` from the result, so the change is identifiable afterwards.
`;
