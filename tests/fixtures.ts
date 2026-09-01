import { client, callTool } from "./client";

/**
 * Content the live suite creates for itself.
 *
 * Every live test used to address items seeded by hand on one particular demo instance —
 * `/sitecore/content/Home/Tests/...` and a hard-coded GUID per test. Of the 75 GUIDs the
 * suite named, 11 resolved on a stock CM; the other 64 existed nowhere but that one
 * machine, so a fresh instance failed the suite with `Get-Item : ... not found` and no
 * indication that the content, not the code, was the problem.
 *
 * Each file now seeds what it needs and deletes it again, so the suite runs against any CM
 * with SPE Remoting enabled.
 *
 * Everything is built from templates that ship with Sitecore — `Common/Folder`, and the
 * three `System/Templates` items behind a data template — rather than from a site's
 * templates, which differ between XM/XP and SitecoreAI. Assertions follow: a test that used
 * to expect the template name `Sample Item` now expects `scratch.template.name`.
 */

export type SeededItem = {
    id: string;
    path: string;
    name: string;
};

/** A field on the fixture template. A bare string is a single-line text field. */
export type FieldSpec = string | { name: string; type?: string };

export type Scratch = {
    /** `/sitecore/content/<unique>` — the tree everything else hangs off. */
    root: SeededItem;
    /** A data template carrying the requested fields, under `/sitecore/templates/<unique>`. */
    template: SeededItem;
    templateFolder: SeededItem;
    /** The items named in the `seedScratch` call, keyed by name. */
    items: Record<string, SeededItem>;
    /** Throws rather than returning undefined, so a typo fails at the call, not in an assertion. */
    item(name: string): SeededItem;
    /** Deletes both roots permanently. Safe to call twice. */
    cleanup(): Promise<void>;
};

/**
 * Test files run in parallel processes against one CM, so the names have to be unique per
 * run — two files seeding `/sitecore/content/MCP-Tests` would delete each other's content
 * halfway through.
 */
function uniqueSuffix(): string {
    return `${Date.now().toString(36)}-${Math.floor(Math.random() * 0xffffff).toString(16)}`;
}

function normalizeFields(fields: FieldSpec[]): { name: string; type: string }[] {
    return fields.map((f) => (typeof f === "string" ? { name: f, type: "Single-Line Text" } : { name: f.name, type: f.type ?? "Single-Line Text" }));
}

/**
 * Runs a script and returns whatever it printed, unwrapped.
 *
 * The scripts here all end in `ConvertTo-Json -Compress` rather than emitting objects:
 * CLIXML serialization of a Sitecore `Item` runs to six figures of characters, and all the
 * caller wants is an id and a path.
 */
async function runScript<T>(script: string, attempts = 3): Promise<T> {
    let lastError = "";
    for (let attempt = 1; attempt <= attempts; attempt++) {
        const result = await callTool(client, "run-powershell-script", { script });
        const text = result.content[0].text ?? "";
        if (!result.isError) {
            const wrapper = JSON.parse(text);
            const payload = Array.isArray(wrapper?.Obj) ? wrapper.Obj[0] : wrapper;
            return (typeof payload === "string" && payload.startsWith("{") ? JSON.parse(payload) : payload) as T;
        }
        lastError = text;
        // Seeding runs at module scope, where vitest's own `retry` does not reach, and a CM
        // with the whole suite on it drops the occasional request with a 500. Retrying here
        // is what keeps a busy instance from failing a file before its first test runs.
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
    throw new Error(`fixture script failed after ${attempts} attempts: ${lastError}`);
}

const AS_SEEDED = '@{ id = $item.ID.ToString(); path = $item.Paths.Path; name = $item.Name }';

function seedScript(rootName: string, itemNames: string[], fields: { name: string; type: string }[]): string {
    const items = itemNames.map((n) => `"${n}"`).join(",");
    const fieldList = fields.map((f) => `@{ name = "${f.name}"; type = "${f.type}" }`).join(",");
    return `
$ErrorActionPreference = "Stop"
$rootName = "${rootName}"
$itemNames = @(${items})
$fieldSpecs = @(${fieldList})

$templateFolder = New-Item -Path "master:/sitecore/templates" -Name $rootName -ItemType "/sitecore/templates/System/Templates/Template folder"
$template = New-Item -Path $templateFolder.Paths.Path -Name "Fixture" -ItemType "/sitecore/templates/System/Templates/Template"
$section = New-Item -Path $template.Paths.Path -Name "Data" -ItemType "/sitecore/templates/System/Templates/Template section"
foreach ($spec in $fieldSpecs) {
    $field = New-Item -Path $section.Paths.Path -Name $spec.name -ItemType "/sitecore/templates/System/Templates/Template field"
    $field.Editing.BeginEdit() | Out-Null
    $field.Type = $spec.type
    $field.Editing.EndEdit() | Out-Null
}

$root = New-Item -Path "master:/sitecore/content" -Name $rootName -ItemType "/sitecore/templates/Common/Folder"

$seeded = @{}
foreach ($itemName in $itemNames) {
    $item = New-Item -Path $root.Paths.Path -Name $itemName -ItemType $template.Paths.Path
    $item.Editing.BeginEdit() | Out-Null
    foreach ($spec in $fieldSpecs) {
        if ($spec.type -eq "Single-Line Text" -or $spec.type -eq "Multi-Line Text" -or $spec.type -eq "Rich Text") {
            $item[$spec.name] = "$($spec.name) of $itemName"
        }
    }
    $item.Editing.EndEdit() | Out-Null
    $seeded[$itemName] = ${AS_SEEDED}
}

@{
    root = @{ id = $root.ID.ToString(); path = $root.Paths.Path; name = $root.Name }
    templateFolder = @{ id = $templateFolder.ID.ToString(); path = $templateFolder.Paths.Path; name = $templateFolder.Name }
    template = @{ id = $template.ID.ToString(); path = $template.Paths.Path; name = $template.Name }
    items = $seeded
} | ConvertTo-Json -Depth 5 -Compress
`.trim();
}

/**
 * Creates `/sitecore/content/<label>-<unique>` holding one item per name, each built from a
 * template this call also creates.
 *
 * Call it at the top of a test file and register the cleanup:
 *
 * ```ts
 * const scratch = await seedScratch("get-item-field", ["Target"]);
 * afterAll(() => scratch.cleanup());
 * ```
 */
export async function seedScratch(
    label: string,
    itemNames: string[] = [],
    fields: FieldSpec[] = ["Title", "Text"],
): Promise<Scratch> {
    const rootName = `MCP-${label}-${uniqueSuffix()}`;
    const seeded = await runScript<any>(seedScript(rootName, itemNames, normalizeFields(fields)));

    let cleaned = false;
    return {
        root: seeded.root,
        template: seeded.template,
        templateFolder: seeded.templateFolder,
        items: seeded.items ?? {},
        item(name: string) {
            const found = (seeded.items ?? {})[name];
            if (!found) {
                throw new Error(
                    `no seeded item named '${name}'; this file seeded: ${Object.keys(seeded.items ?? {}).join(", ") || "(none)"}`
                );
            }
            return found;
        },
        async cleanup() {
            if (cleaned) {
                return;
            }
            cleaned = true;
            // -Permanently, or every run leaves its fixtures in the recycle bin and the
            // archive tests start counting other files' rubbish.
            //
            // The archive sweep afterwards is for what the *tests* deleted rather than what
            // this created: removing an item's last version archives the item, and a clone
            // deleted through item-service-delete-item goes the same way, so entries outlive
            // the tree they came from.
            // Best effort: a cleanup that throws fails a file whose tests all passed, and the
            // CM refusing one delete under load is not a defect in the code under test. What
            // is left behind is visible in the instance and swept by the next run's names.
            try {
                await runScript(`
$ErrorActionPreference = "SilentlyContinue"
Remove-Item -Path "master:${seeded.root.path}" -Recurse -Permanently
Remove-Item -Path "master:${seeded.templateFolder.path}" -Recurse -Permanently

$archive = Get-Archive -Name "recyclebin" -Database (Get-Database "master")
if ($archive) {
    $entries = Get-ArchiveItem -Archive $archive | Where-Object {
        $_.OriginalLocation -like "${seeded.root.path}*" -or $_.OriginalLocation -like "${seeded.templateFolder.path}*"
    }
    foreach ($entry in $entries) {
        Remove-ArchiveItem -Archive $archive -ItemId $entry.ItemId
    }
}
'"cleaned"'
`.trim());
            } catch (error) {
                console.warn(`fixture cleanup for ${seeded.root.path} did not complete: ${error}`);
            }
        },
    };
}

/** Adds a child under an already-seeded item, built from the same fixture template. */
export async function seedChild(scratch: Scratch, parent: SeededItem, name: string): Promise<SeededItem> {
    return runScript<SeededItem>(
        `$item = New-Item -Path "master:${parent.path}" -Name "${name}" -ItemType "${scratch.template.path}"\n`
        + `${AS_SEEDED} | ConvertTo-Json -Compress`
    );
}

/** A second data template, for the tests that switch an item's template or its base. */
export async function seedTemplate(scratch: Scratch, name: string, fields: FieldSpec[] = []): Promise<SeededItem> {
    const specs = normalizeFields(fields);
    return runScript<SeededItem>(`
$ErrorActionPreference = "Stop"
$item = New-Item -Path "master:${scratch.templateFolder.path}" -Name "${name}" -ItemType "/sitecore/templates/System/Templates/Template"
${specs.length ? `$section = New-Item -Path $item.Paths.Path -Name "Data" -ItemType "/sitecore/templates/System/Templates/Template section"` : ""}
${specs.map((f) => `
$field = New-Item -Path $section.Paths.Path -Name "${f.name}" -ItemType "/sitecore/templates/System/Templates/Template field"
$field.Editing.BeginEdit() | Out-Null
$field.Type = "${f.type}"
$field.Editing.EndEdit() | Out-Null`).join("\n")}
${AS_SEEDED} | ConvertTo-Json -Compress
`.trim());
}

/** Writes a field value, so a test can arrange the state it is about to assert on. */
export async function setField(item: SeededItem, field: string, value: string): Promise<void> {
    await runScript(`
$item = Get-Item -Path "master:${item.id}"
$item.Editing.BeginEdit() | Out-Null
$item["${field}"] = "${value.replace(/"/g, '""')}"
$item.Editing.EndEdit() | Out-Null
'"set"'
`.trim());
}

/**
 * Points `from`'s link field at `to`, which is what makes one item a *reference* of the
 * other — the relationship `common-get-item-reference` and `-referrer` read in opposite
 * directions. Seed the template with a link-typed field (`{ name: "Link", type: "Droptree" }`)
 * for this to have somewhere to write.
 */
export async function linkItems(from: SeededItem, to: SeededItem, field = "Link"): Promise<void> {
    await setField(from, field, to.id);
}

/**
 * Puts items into a workflow and its first state.
 *
 * `Sample Workflow` ships with Sitecore, so the workflow itself needs no seeding — only the
 * assignment does, because a stock item is in no workflow at all and every workflow tool
 * returns nothing for it.
 */
export const SAMPLE_WORKFLOW = {
    id: "{A5BC37E7-ED96-4C1E-8590-A26E64DB55EA}",
    draft: "{190B1C84-F1BE-47ED-AA41-F42193D9C8FC}",
    awaitingApproval: "{46DA5376-10DC-4B66-B464-AFDAA29DE84F}",
    approved: "{FCA998C5-0CC3-4F91-94D8-0A4E6CAECE88}",
} as const;

export async function assignWorkflow(items: SeededItem[], state: string = SAMPLE_WORKFLOW.draft): Promise<void> {
    const ids = items.map((i) => `"${i.id}"`).join(",");
    await runScript(`
$ErrorActionPreference = "Stop"
foreach ($id in @(${ids})) {
    $item = Get-Item -Path "master:$id"
    $item.Editing.BeginEdit() | Out-Null
    $item["__Workflow"] = "${SAMPLE_WORKFLOW.id}"
    $item["__Workflow state"] = "${state}"
    $item.Editing.EndEdit() | Out-Null
}
'"assigned"'
`.trim());
}

/**
 * Layouts, renderings and a placeholder setting of the suite's own making.
 *
 * The presentation tests used to point at `Sample Layout`, `Sample Rendering` and a
 * project's own components; the first two ship only with the Sample site and the third
 * existed on one instance. These are built from the `System/Layout` templates, which are
 * part of Sitecore itself, and live under the scratch template folder so cleanup takes
 * them.
 */
export type Presentation = {
    layout: SeededItem;
    otherLayout: SeededItem;
    rendering: SeededItem;
    otherRendering: SeededItem;
    placeholderSetting: SeededItem;
    /** The placeholder key the seeded renderings are added into. */
    placeholderKey: string;
};

export async function seedPresentation(scratch: Scratch): Promise<Presentation> {
    const placeholderKey = "main";
    const seeded = await runScript<any>(`
$ErrorActionPreference = "Stop"
$folder = "master:${scratch.templateFolder.path}"

$layout = New-Item -Path $folder -Name "Layout One" -ItemType "/sitecore/templates/System/Layout/Layout"
$otherLayout = New-Item -Path $folder -Name "Layout Two" -ItemType "/sitecore/templates/System/Layout/Layout"
$rendering = New-Item -Path $folder -Name "Rendering One" -ItemType "/sitecore/templates/System/Layout/Renderings/View rendering"
$otherRendering = New-Item -Path $folder -Name "Rendering Two" -ItemType "/sitecore/templates/System/Layout/Renderings/View rendering"
$placeholder = New-Item -Path $folder -Name "Placeholder" -ItemType "/sitecore/templates/System/Layout/Placeholder"
$placeholder.Editing.BeginEdit() | Out-Null
$placeholder["Placeholder Key"] = "${placeholderKey}"
$placeholder.Editing.EndEdit() | Out-Null

$asItem = { param($i) @{ id = $i.ID.ToString(); path = $i.Paths.Path; name = $i.Name } }
@{
    layout = (& $asItem $layout)
    otherLayout = (& $asItem $otherLayout)
    rendering = (& $asItem $rendering)
    otherRendering = (& $asItem $otherRendering)
    placeholderSetting = (& $asItem $placeholder)
} | ConvertTo-Json -Depth 5 -Compress
`.trim());

    return { ...seeded, placeholderKey };
}

/**
 * Puts a layout and one rendering onto an item and reports the rendering's unique id.
 *
 * The presentation tests need an item that already has presentation on it, and the unique
 * id Sitecore mints when a rendering is added is the handle most of them address it by.
 * Arranging this through SPE rather than through `presentation-set-layout` /
 * `presentation-add-rendering` keeps the tool under test out of its own fixture.
 */
export async function applyPresentation(
    item: SeededItem,
    presentation: Presentation,
    options: { language?: string; finalLayout?: boolean; placeholder?: string; datasource?: string; rendering?: SeededItem } = {},
): Promise<{ uniqueId: string; placeholder: string }> {
    const language = options.language ?? "en";
    const finalLayout = options.finalLayout ?? true;
    const placeholder = options.placeholder ?? `/${presentation.placeholderKey}`;
    const rendering = options.rendering ?? presentation.rendering;

    const result = await runScript<{ uniqueId: string }>(`
$ErrorActionPreference = "Stop"
$item = Get-Item -Path "master:${item.id}" -Language "${language}"
$layout = Get-Item -Path "master:${presentation.layout.id}"

# Set-Layout and Add-Rendering both require a device, and Add-Rendering takes a rendering
# *definition* rather than the rendering item -- New-Rendering is what turns one into the
# other. This mirrors what the presentation-* tools build.
$device = Get-LayoutDevice -Default
$rendering = New-Rendering -Id "${rendering.id}" -Database "master"

Set-Layout -Item $item -Layout $layout -Device $device ${finalLayout ? "-FinalLayout" : ""}
Add-Rendering -Item $item -Instance $rendering -PlaceHolder "${placeholder}"${options.datasource ? ` -DataSource "${options.datasource}"` : ""} -Device $device ${finalLayout ? "-FinalLayout" : ""}

$added = Get-Rendering -Item $item -PlaceHolder "${placeholder}" -Device $device ${finalLayout ? "-FinalLayout" : ""} | Select-Object -First 1
@{ uniqueId = $added.UniqueId } | ConvertTo-Json -Compress
`.trim());

    return { uniqueId: result.uniqueId, placeholder };
}

/**
 * Writes an entry into an item's workflow history.
 *
 * Assigning a workflow does not create history — only a transition does — so a test that
 * reads history has to have one put there, and arranging it through SPE keeps the read tool
 * under test from depending on the write tool beside it.
 */
export async function addWorkflowEvent(
    item: SeededItem,
    oldState: string = SAMPLE_WORKFLOW.draft,
    newState: string = SAMPLE_WORKFLOW.draft,
    text = "seeded",
): Promise<void> {
    await runScript(`
$ErrorActionPreference = "Stop"
$item = Get-Item -Path "master:${item.id}"
New-ItemWorkflowEvent -Item $item -OldState "${oldState}" -NewState "${newState}" -Text "${text}" | Out-Null
'"added"'
`.trim());
}

/**
 * A Sitecore user or role of this run's own making, in the `sitecore` domain.
 *
 * The security tests used to name `sitecore\Developer` and friends, which exist on some
 * topologies and not others, and left the instance holding whatever they created. These
 * carry a random suffix so parallel files cannot collide, and remove themselves.
 */
export type SeededAccount = {
    /** Domain-qualified, e.g. `sitecore\MCP-acl-k2j3h4`. */
    name: string;
    /** Without the domain prefix. */
    localName: string;
    remove(): Promise<void>;
};

async function seedAccount(kind: "user" | "role", label: string, password?: string): Promise<SeededAccount> {
    const localName = `MCP-${label}-${uniqueSuffix()}`;
    const name = `sitecore${String.fromCharCode(92)}${localName}`;
    const create = kind === "user"
        ? `New-User -Identity "${name}" -Enabled -Password "${password ?? "b"}" | Out-Null`
        : `New-Role -Identity "${name}" | Out-Null`;

    await runScript(`
$ErrorActionPreference = "Stop"
${create}
'"created"'
`.trim());

    return {
        name,
        localName,
        async remove() {
            await runScript(
                `Remove-${kind === "user" ? "User" : "Role"} -Identity "${name}" -ErrorAction SilentlyContinue
'"removed"'`
            );
        },
    };
}

export const seedUser = (label: string, password = "b") => seedAccount("user", label, password);
export const seedRole = (label: string) => seedAccount("role", label);

/**
 * Makes sure a language exists, creating it if it does not, and reports whether this call
 * created it so the caller can put the instance back.
 *
 * Only `en` is guaranteed on a CM; the version tests used to assume `fr-CA` and `ja-JP` were
 * there because the demo instance happened to have them.
 *
 * Every file that calls this passes a *different* locale. Files run in parallel, and two of
 * them sharing one language means the first to finish removes it while the second is still
 * writing versions in it.
 */
export async function ensureLanguage(code: string): Promise<{ created: boolean; remove(): Promise<void> }> {
    const created = await runScript<{ created: boolean }>(`
$ErrorActionPreference = "Stop"
$path = "master:/sitecore/system/Languages/${code}"
$existing = Get-Item -Path $path -ErrorAction SilentlyContinue
if ($existing) {
    @{ created = $false } | ConvertTo-Json -Compress
} else {
    $language = New-Item -Path "master:/sitecore/system/Languages" -Name "${code}" -ItemType "/sitecore/templates/System/Language"
    $language.Editing.BeginEdit() | Out-Null
    $language["Iso"] = "${code.split("-")[0]}"
    $language.Editing.EndEdit() | Out-Null
    @{ created = $true } | ConvertTo-Json -Compress
}
`.trim());

    return {
        created: created.created,
        async remove() {
            if (!created.created) {
                return;
            }
            await runScript(`Remove-Item -Path "master:/sitecore/system/Languages/${code}" -Recurse -Permanently -ErrorAction SilentlyContinue\n'"removed"'`);
        },
    };
}
