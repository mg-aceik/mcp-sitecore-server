import { describe, it, expect, vi, beforeEach } from "vitest";

// The Done-When for Tier 2 says *every* merged tool errors cleanly on zero or two
// addressing inputs, and that both branches work. That is 48 tools, most of them
// destructive or environment-specific enough that calling them all against a live CM would
// be reckless (publish, ACL writes, index rebuilds, layout resets). So this sweep drives
// every one of them with the PowerShell layer mocked: four calls each, checking that the
// two invalid shapes stop in TypeScript and that the two valid ones reach the CM boundary
// carrying the identifier the caller supplied.
//
// merged-targets.test.ts covers what each branch builds in detail; this file is about
// completeness, so a tool cannot be added or renamed without appearing here.

const { runGeneric, getItemById, getItemByPath } = vi.hoisted(() => ({
    runGeneric: vi.fn(),
    getItemById: vi.fn(),
    getItemByPath: vi.fn(),
}));

vi.mock("../../src/tools/powershell/simple/generic", () => ({
    runGenericPowershellCommand: runGeneric,
}));
vi.mock("../../src/tools/item-service/logic/simple/get-item", () => ({ getItemById }));
vi.mock("../../src/tools/item-service/logic/simple/get-item-by-path", () => ({ getItemByPath }));

import { getItemTool } from "../../src/tools/item-service/tools/simple/get-item";
import { mediaUploadTool } from "../../src/tools/powershell/media/media-upload";
import { newItemClonePowerShellTool } from "../../src/tools/powershell/composite/common/new-item-clone";
import { updateItemReferrerPowerShellTool } from "../../src/tools/powershell/composite/common/update-item-referrer";
import { initializeSearchIndexingItemPowerShellTool } from "../../src/tools/powershell/composite/indexing/initialialize-search-indexing-item";
import { removeSearchIndexItemPowerShellTool } from "../../src/tools/powershell/composite/indexing/remove-search-index-item";
import { addPlaceholderSettingPowershellTool } from "../../src/tools/powershell/composite/presentation/add-placeholder-setting";
import { addRenderingPowershellTool } from "../../src/tools/powershell/composite/presentation/add-rendering";
import { getRenderingParameterPowershellTool } from "../../src/tools/powershell/composite/presentation/get-rendering-parameter";
import { listRenderingsPowershellTool } from "../../src/tools/powershell/composite/presentation/list-renderings";
import { removeRenderingParameterPowershellTool } from "../../src/tools/powershell/composite/presentation/remove-rendering-parameter";
import { setLayoutPowershellTool } from "../../src/tools/powershell/composite/presentation/set-layout";
import { setRenderingParameterPowershellTool } from "../../src/tools/powershell/composite/presentation/set-rendering-parameter";
import { setRenderingPowershellTool } from "../../src/tools/powershell/composite/presentation/set-rendering";
import { switchRenderingPowershellTool } from "../../src/tools/powershell/composite/presentation/switch-rendering";
import { setItemAclPowerShellTool } from "../../src/tools/powershell/composite/security/set-item-acl";
import { addBaseTemplatePowerShellTool } from "../../src/tools/powershell/simple/common/add-base-template";
import { addItemVersionPowerShellTool } from "../../src/tools/powershell/simple/common/add-item-version";
import { convertFromItemClonePowerShellTool } from "../../src/tools/powershell/simple/common/convert-from-item-clone";
import { getItemClonePowerShellTool } from "../../src/tools/powershell/simple/common/get-item-clone";
import { getItemFieldPowerShellTool } from "../../src/tools/powershell/simple/common/get-item-field";
import { getItemReferencePowerShellTool } from "../../src/tools/powershell/simple/common/get-item-reference";
import { getItemReferrerPowerShellTool } from "../../src/tools/powershell/simple/common/get-item-referrer";
import { getItemTemplatePowerShellTool } from "../../src/tools/powershell/simple/common/get-item-template";
import { getItemWorkflowEventPowerShellTool } from "../../src/tools/powershell/simple/common/get-item-workflow-event";
import { invokeWorkflowPowerShellTool } from "../../src/tools/powershell/simple/common/invoke-workflow";
import { newItemWorkflowEventPowerShellTool } from "../../src/tools/powershell/simple/common/new-item-workflow-event";
import { publishItemPowerShellTool } from "../../src/tools/powershell/simple/common/publish-item";
import { removeBaseTemplatePowerShellTool } from "../../src/tools/powershell/simple/common/remove-base-template";
import { removeItemVersionPowerShellTool } from "../../src/tools/powershell/simple/common/remove-item-version";
import { resetItemFieldPowerShellTool } from "../../src/tools/powershell/simple/common/reset-item-field";
import { setItemTemplatePowerShellTool } from "../../src/tools/powershell/simple/common/set-item-template";
import { testBaseTemplatePowerShellTool } from "../../src/tools/powershell/simple/common/test-base-template";
import { getLayoutPowershellTool } from "../../src/tools/powershell/simple/presentation/get-layout";
import { getPlaceholderSettingPowershellTool } from "../../src/tools/powershell/simple/presentation/get-placeholder-setting";
import { getRenderingPowershellTool } from "../../src/tools/powershell/simple/presentation/get-rendering";
import { mergeLayoutPowershellTool } from "../../src/tools/powershell/simple/presentation/merge-layout";
import { removePlaceholderSettingPowershellTool } from "../../src/tools/powershell/simple/presentation/remove-placeholder-setting";
import { removeRenderingPowershellTool } from "../../src/tools/powershell/simple/presentation/remove-rendering";
import { resetLayoutPowershellTool } from "../../src/tools/powershell/simple/presentation/reset-layout";
import { getItemPowerShellTool } from "../../src/tools/powershell/simple/provider/get-item";
import { addItemAclPowerShellTool } from "../../src/tools/powershell/simple/security/add-item-acl";
import { clearItemAclPowerShellTool } from "../../src/tools/powershell/simple/security/clear-item-acl";
import { getItemAclPowerShellTool } from "../../src/tools/powershell/simple/security/get-item-acl";
import { lockItemPowerShellTool } from "../../src/tools/powershell/simple/security/lock-item";
import { protectItemPowerShellTool } from "../../src/tools/powershell/simple/security/protect-item";
import { testItemAclPowerShellTool } from "../../src/tools/powershell/simple/security/test-item-acl";
import { unlockItemPowerShellTool } from "../../src/tools/powershell/simple/security/unlock-item";
import { unprotectItemPowerShellTool } from "../../src/tools/powershell/simple/security/unprotect-item";

type Registrar = (server: any, config: any) => void;

const ID = "{11111111-2222-3333-4444-555555555555}";
const PATH = "master:/sitecore/content/Home/Tier2";

/** The second target a few tools also need, so the sweep tests the first one in isolation. */
const RENDERING = { renderingId: "{99999999-9999-9999-9999-999999999999}" };
const SETTING = { placeholderSettingId: "{88888888-8888-8888-8888-888888888888}" };
const LAYOUT = { layoutId: "{77777777-7777-7777-7777-777777777777}" };
const SWITCH = { uniqueId: "{66666666-6666-6666-6666-666666666666}", newRenderingId: RENDERING.renderingId };

// Every merged tool, its registrar, and any extra arguments it needs before the addressing
// inputs are the only thing under test.
const MERGED: Array<[string, Registrar, Record<string, unknown>?]> = [
    ["common-add-base-template", addBaseTemplatePowerShellTool],
    ["common-add-item-version", addItemVersionPowerShellTool],
    ["common-convert-from-item-clone", convertFromItemClonePowerShellTool],
    ["common-get-item-clone", getItemClonePowerShellTool],
    ["common-get-item-field", getItemFieldPowerShellTool],
    ["common-get-item-reference", getItemReferencePowerShellTool],
    ["common-get-item-referrer", getItemReferrerPowerShellTool],
    ["common-get-item-template", getItemTemplatePowerShellTool],
    ["common-get-item-workflow-event", getItemWorkflowEventPowerShellTool],
    ["common-invoke-workflow", invokeWorkflowPowerShellTool],
    ["common-new-item-clone", newItemClonePowerShellTool],
    ["common-new-item-workflow-event", newItemWorkflowEventPowerShellTool],
    ["common-publish-item", publishItemPowerShellTool],
    ["common-remove-base-template", removeBaseTemplatePowerShellTool],
    ["common-remove-item-version", removeItemVersionPowerShellTool],
    ["common-reset-item-field", resetItemFieldPowerShellTool],
    ["common-set-item-template", setItemTemplatePowerShellTool],
    ["common-test-base-template", testBaseTemplatePowerShellTool],
    ["common-update-item-referrer", updateItemReferrerPowerShellTool],
    ["indexing-initialize-search-index-item", initializeSearchIndexingItemPowerShellTool, { database: "master" }],
    ["indexing-remove-search-index-item", removeSearchIndexItemPowerShellTool, { database: "master" }],
    ["presentation-add-placeholder-setting", addPlaceholderSettingPowershellTool, { ...SETTING, database: "master" }],
    ["presentation-add-rendering", addRenderingPowershellTool, { ...RENDERING, database: "master" }],
    ["presentation-get-layout", getLayoutPowershellTool],
    ["presentation-get-placeholder-setting", getPlaceholderSettingPowershellTool, { database: "master" }],
    ["presentation-get-rendering", getRenderingPowershellTool],
    ["presentation-get-rendering-parameter", getRenderingParameterPowershellTool, { database: "master" }],
    ["presentation-list-renderings", listRenderingsPowershellTool],
    ["presentation-merge-layout", mergeLayoutPowershellTool],
    ["presentation-remove-placeholder-setting", removePlaceholderSettingPowershellTool, { database: "master" }],
    ["presentation-remove-rendering", removeRenderingPowershellTool],
    ["presentation-remove-rendering-parameter", removeRenderingParameterPowershellTool, { database: "master" }],
    ["presentation-reset-layout", resetLayoutPowershellTool],
    ["presentation-set-layout", setLayoutPowershellTool, { ...LAYOUT, database: "master" }],
    ["presentation-set-rendering", setRenderingPowershellTool, { database: "master" }],
    ["presentation-set-rendering-parameter", setRenderingParameterPowershellTool, { database: "master" }],
    ["presentation-switch-rendering", switchRenderingPowershellTool, { ...SWITCH, database: "master" }],
    ["provider-get-item", getItemPowerShellTool],
    ["security-add-item-acl", addItemAclPowerShellTool],
    ["security-clear-item-acl", clearItemAclPowerShellTool],
    ["security-get-item-acl", getItemAclPowerShellTool],
    ["security-lock-item", lockItemPowerShellTool],
    ["security-protect-item", protectItemPowerShellTool],
    ["security-set-item-acl", setItemAclPowerShellTool, { database: "master" }],
    ["security-test-item-acl", testItemAclPowerShellTool],
    ["security-unlock-item", unlockItemPowerShellTool],
    ["security-unprotect-item", unprotectItemPowerShellTool],
];

function mount(registrar: Registrar, name: string) {
    let handler: ((params: any) => Promise<any>) | undefined;
    const server = {
        registerTool: (registered: string, _config: unknown, cb: (params: any) => Promise<any>) => {
            if (registered === name) handler = cb;
        },
    };
    registrar(server, {} as any);
    if (!handler) throw new Error(`${name} was not registered`);
    return handler;
}

beforeEach(() => {
    runGeneric.mockReset();
    runGeneric.mockResolvedValue({ content: [{ type: "text", text: "{}" }] });
    getItemById.mockReset();
    getItemById.mockResolvedValue({ content: [{ type: "text", text: "by id" }] });
    getItemByPath.mockReset();
    getItemByPath.mockResolvedValue({ content: [{ type: "text", text: "by path" }] });
});

describe("every merged tool", () => {
    for (const [name, registrar, extra] of MERGED) {
        it(`${name} requires exactly one of id and path`, async () => {
            const handler = mount(registrar, name);

            const none = await handler({ ...extra });
            expect(none.isError, "no addressing input").toBe(true);
            expect(none.content[0].text).toContain("Supply exactly one of");
            expect(runGeneric).not.toHaveBeenCalled();

            const both = await handler({ ...extra, id: ID, path: PATH });
            expect(both.isError, "two addressing inputs").toBe(true);
            expect(both.content[0].text).toContain("one call cannot mean two items");
            expect(runGeneric).not.toHaveBeenCalled();

            runGeneric.mockClear();
            await handler({ ...extra, id: ID });
            expect(runGeneric, "the id branch reaches PowerShell").toHaveBeenCalledTimes(1);
            const byId = JSON.stringify(runGeneric.mock.calls[0].slice(1, 3));
            expect(byId, "the id branch carries the id").toContain(ID);
            expect(byId).not.toContain(PATH);

            runGeneric.mockClear();
            await handler({ ...extra, path: PATH });
            expect(runGeneric, "the path branch reaches PowerShell").toHaveBeenCalledTimes(1);
            const byPath = JSON.stringify(runGeneric.mock.calls[0].slice(1, 3));
            expect(byPath, "the path branch carries the path").toContain(PATH);
            expect(byPath).not.toContain(ID);
        });
    }

    // The item-service tool talks to the REST endpoint rather than PowerShell, and each
    // address is a different request, so it is checked against its own two logic functions.
    it("item-service-get-item requires exactly one of id and path", async () => {
        const handler = mount(getItemTool, "item-service-get-item");

        expect((await handler({})).isError).toBe(true);
        expect((await handler({ id: ID, path: "/sitecore/content/Home" })).isError).toBe(true);
        expect(getItemById).not.toHaveBeenCalled();
        expect(getItemByPath).not.toHaveBeenCalled();

        await handler({ id: ID });
        expect(getItemById).toHaveBeenCalledWith(expect.anything(), ID, {});
        expect(getItemByPath).not.toHaveBeenCalled();

        await handler({ path: "/sitecore/content/Home" });
        expect(getItemByPath).toHaveBeenCalledWith(expect.anything(), "/sitecore/content/Home", {});
    });

    // media-upload validates its *source* (sourceUrl / filePath / content) with the same
    // discriminator the merged tools use for addressing, so it appears in the sweep — but
    // the id/path harness above does not fit it. Only the invalid shapes are checked here:
    // both stop in TypeScript before any bytes are fetched or sent, and the valid shapes
    // are live-tested (they need a CM and a real blob).
    it("media-upload requires exactly one of sourceUrl, filePath and content", async () => {
        const handler = mount(mediaUploadTool, "media-upload");

        const none = await handler({ destination: "Project/Test/photo.jpg", database: "master" });
        expect(none.isError).toBe(true);
        expect(none.content[0].text).toContain("'sourceUrl', 'filePath' or 'content'");

        const two = await handler({
            destination: "Project/Test/photo.jpg", database: "master",
            sourceUrl: "https://example.com/a.jpg", content: "aGk=",
        });
        expect(two.isError).toBe(true);
        expect(runGeneric).not.toHaveBeenCalled();
    });

    it("covers every tool that validates an addressing input", async () => {
        // A merged tool that is not in the table above is a tool nobody is checking.
        const { readdirSync, readFileSync, statSync } = await import("node:fs");
        const walk = (dir: string): string[] => readdirSync(dir).flatMap((entry) => {
            const full = `${dir}/${entry}`;
            return statSync(full).isDirectory() ? walk(full) : full.endsWith(".ts") ? [full] : [];
        });

        const registered = walk("src/tools")
            .filter((file) => readFileSync(file, "utf8").includes("requireOneTarget("))
            .flatMap((file) => [...readFileSync(file, "utf8").matchAll(/registerTool\(\s*["']([a-z0-9-]+)["']/g)]
                .map((m) => m[1]));

        const covered = new Set([...MERGED.map(([name]) => name), "item-service-get-item", "media-upload"]);

        // The authoring tools validate addressing the same way but reach Sitecore over
        // HTTP rather than through the PowerShell layer this file mocks, so their sweep
        // lives in authoring.test.ts ("authoring addressing validation") -- which carries
        // its own completeness guard over src/tools/authoring, so nothing slips through
        // by being listed here.
        const coveredByAuthoringSweep = (name: string) => name.startsWith("authoring-");

        expect([...new Set(registered)]
            .filter((name) => !covered.has(name) && !coveredByAuthoringSweep(name))
        ).toEqual([]);
    });
});
