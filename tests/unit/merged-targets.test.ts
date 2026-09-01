import { describe, it, expect, vi, beforeEach } from "vitest";

// Tier 2 merged every -by-id/-by-path family into one tool, so the addressing branch is now
// runtime behaviour rather than a choice of tool. These tests pin both halves of that: the
// input validation that rejects zero or two addressing inputs before any PowerShell is
// built, and the option construction each branch produces — which must still be exactly
// what the variant tool it replaced produced.
//
// This is also how the destructive families are covered. Calling security-set-item-acl or
// common-publish-item against a live CM to see which parameter they send is not a test
// anyone should run twice, so the PowerShell layer is mocked and the built command asserted.

const { runGeneric } = vi.hoisted(() => ({ runGeneric: vi.fn() }));

vi.mock("../../src/tools/powershell/simple/generic", () => ({
    runGenericPowershellCommand: runGeneric,
}));

import { publishItemPowerShellTool } from "../../src/tools/powershell/simple/common/publish-item";
import { getItemTemplatePowerShellTool } from "../../src/tools/powershell/simple/common/get-item-template";
import { getItemReferencePowerShellTool } from "../../src/tools/powershell/simple/common/get-item-reference";
import { removeItemVersionPowerShellTool } from "../../src/tools/powershell/simple/common/remove-item-version";
import { newItemClonePowerShellTool } from "../../src/tools/powershell/composite/common/new-item-clone";
import { testItemAclPowerShellTool } from "../../src/tools/powershell/simple/security/test-item-acl";
import { setItemLockPowerShellTool } from "../../src/tools/powershell/composite/security/set-item-lock";
import { setItemAclPowerShellTool } from "../../src/tools/powershell/composite/security/set-item-acl";
import { getLayoutPowershellTool } from "../../src/tools/powershell/simple/presentation/get-layout";
import { removeRenderingPowershellTool } from "../../src/tools/powershell/simple/presentation/remove-rendering";
import { mergeLayoutPowershellTool } from "../../src/tools/powershell/simple/presentation/merge-layout";
import { getRenderingParameterPowershellTool } from "../../src/tools/powershell/composite/presentation/get-rendering-parameter";
import { setLayoutPowershellTool } from "../../src/tools/powershell/composite/presentation/set-layout";
import { addRenderingPowershellTool } from "../../src/tools/powershell/composite/presentation/add-rendering";
import { switchRenderingPowershellTool } from "../../src/tools/powershell/composite/presentation/switch-rendering";
import { listRenderingsPowershellTool } from "../../src/tools/powershell/composite/presentation/list-renderings";
import { getItemPowerShellTool } from "../../src/tools/powershell/simple/provider/get-item";

type Registrar = (server: any, config: any) => void;

type Call = {
    command: string;
    options: Record<string, any>;
};

/** Registers one tool registrar against a stub server and returns a way to call it. */
function mount(registrar: Registrar) {
    const tools = new Map<string, (params: any) => Promise<any>>();
    const server = {
        registerTool: (name: string, _config: unknown, handler: (params: any) => Promise<any>) => {
            tools.set(name, handler);
        },
    };
    registrar(server, {} as any);

    return {
        names: [...tools.keys()],
        async call(name: string, params: Record<string, unknown>): Promise<{ result: any; call?: Call }> {
            const handler = tools.get(name);
            if (!handler) {
                throw new Error(`${name} was not registered; got ${[...tools.keys()].join(", ")}`);
            }
            runGeneric.mockClear();
            const result = await handler(params);
            const args = runGeneric.mock.calls[0];
            return {
                result,
                call: args ? { command: args[1], options: args[2] } : undefined,
            };
        },
    };
}

beforeEach(() => {
    runGeneric.mockReset();
    runGeneric.mockResolvedValue({ content: [{ type: "text", text: "{}" }] });
});

describe("addressing validation", () => {
    const cases: Array<{ tool: string; registrar: Registrar; inputs: string[]; extra?: Record<string, unknown> }> = [
        { tool: "common-publish-item", registrar: publishItemPowerShellTool, inputs: ["id", "path"] },
        { tool: "common-remove-item-version", registrar: removeItemVersionPowerShellTool, inputs: ["id", "path"], extra: { language: "en" } },
        { tool: "security-set-item-lock", registrar: setItemLockPowerShellTool, inputs: ["id", "path"], extra: { action: "lock" } },
        { tool: "security-set-item-acl", registrar: setItemAclPowerShellTool, inputs: ["id", "path"], extra: { identity: "sitecore\\admin", accessRight: "item:read", propagationType: "Entity", securityPermission: "AllowAccess", database: "master" } },
        { tool: "presentation-remove-rendering", registrar: removeRenderingPowershellTool, inputs: ["id", "path"], extra: { uniqueId: "{A}" } },
        { tool: "presentation-list-renderings", registrar: listRenderingsPowershellTool, inputs: ["id", "path"] },
        { tool: "provider-get-item", registrar: getItemPowerShellTool, inputs: ["path", "id", "query", "uri"] },
    ];

    for (const { tool, registrar, inputs, extra } of cases) {
        it(`${tool} rejects no addressing input`, async () => {
            const { result, call } = await mount(registrar).call(tool, { ...extra });
            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain(`Supply exactly one of ${inputs.map((i) => `'${i}'`).slice(0, -1).join(", ")}`);
            expect(result.content[0].text).toContain("None was supplied");
            // The point of validating in TypeScript: nothing reached the CM.
            expect(call).toBeUndefined();
        });

        it(`${tool} rejects two addressing inputs`, async () => {
            const [first, second] = inputs;
            const { result, call } = await mount(registrar).call(tool, {
                ...extra,
                [first]: "{11111111-1111-1111-1111-111111111111}",
                [second]: "/sitecore/content/Home",
            });
            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("one call cannot mean two items");
            expect(result.content[0].text).toContain(`'${first}', '${second}'`);
            expect(call).toBeUndefined();
        });

        it(`${tool} treats a blank string as no input`, async () => {
            const { result } = await mount(registrar).call(tool, { ...extra, [inputs[0]]: "   " });
            expect(result.isError).toBe(true);
        });
    }
});

describe("option construction per branch", () => {
    it("common-publish-item sends -Id or -Path, as its two tools did", async () => {
        const tool = mount(publishItemPowerShellTool);

        const byId = await tool.call("common-publish-item", { id: "{ABC}" });
        expect(byId.call!.command).toBe("Publish-Item");
        expect(byId.call!.options).toMatchObject({ Id: "{ABC}" });
        expect(byId.call!.options).not.toHaveProperty("Path");

        const byPath = await tool.call("common-publish-item", { path: "/sitecore/content/Home" });
        expect(byPath.call!.options).toMatchObject({ Path: "/sitecore/content/Home" });
        expect(byPath.call!.options).not.toHaveProperty("Id");
    });

    it("keeps the -ID spelling for the cmdlets that were called with it", async () => {
        // Get-ItemReference took -ID; Get-ItemTemplate took -Id. The merge preserves both
        // rather than tidying them, because SPE parameter names are not ours to normalize.
        const reference = await mount(getItemReferencePowerShellTool)
            .call("common-get-item-reference", { id: "{ABC}" });
        expect(reference.call!.options).toHaveProperty("ID", "{ABC}");

        const template = await mount(getItemTemplatePowerShellTool)
            .call("common-get-item-template", { id: "{ABC}" });
        expect(template.call!.options).toHaveProperty("Id", "{ABC}");

        const acl = await mount(testItemAclPowerShellTool)
            .call("security-test-item-acl", { id: "{ABC}", identity: "sitecore\\admin", accessRight: "item:read" });
        expect(acl.call!.options).toHaveProperty("ID", "{ABC}");
    });

    it("common-new-item-clone assigns the addressing parameter into the built parameter set", async () => {
        const tool = mount(newItemClonePowerShellTool);

        const byId = await tool.call("common-new-item-clone", { id: "{ABC}", destination: "/sitecore/content", name: "Clone" });
        expect(byId.call!.command).toContain("-Id '{ABC}' -Name 'Clone'");

        const byPath = await tool.call("common-new-item-clone", { path: "/sitecore/content/Home", destination: "/sitecore/content", name: "Clone" });
        expect(byPath.call!.command).toContain("-Path '/sitecore/content/Home' -Name 'Clone'");
    });

    it("presentation tools send the database with an ID and never with a path", async () => {
        // The path variants of these tools had no database parameter at all: a path carries
        // its own db: prefix. Sending one on the path branch would be a new behaviour.
        const layout = mount(getLayoutPowershellTool);
        const byId = await layout.call("presentation-get-layout", { id: "{ABC}" });
        expect(byId.call!.options).toMatchObject({ Id: "{ABC}" });

        const merge = mount(mergeLayoutPowershellTool);
        const mergeById = await merge.call("presentation-merge-layout", { id: "{ABC}", database: "web" });
        expect(mergeById.call!.options).toMatchObject({ Id: "{ABC}", Database: "web" });

        const mergeByPath = await merge.call("presentation-merge-layout", { path: "master:/sitecore/content/Home", database: "web" });
        expect(mergeByPath.call!.options).toMatchObject({ Path: "master:/sitecore/content/Home" });
        expect(mergeByPath.call!.options.Database).toBeUndefined();

        const rendering = mount(removeRenderingPowershellTool);
        const removeByPath = await rendering.call("presentation-remove-rendering", { path: "/sitecore/content/Home", uniqueId: "{U}" });
        expect(removeByPath.call!.options).toMatchObject({ Path: "/sitecore/content/Home", UniqueId: "{U}" });
        expect(removeByPath.call!.options.Database).toBeUndefined();
    });

    it("presentation-get-rendering-parameter names the item the way the caller did", async () => {
        const tool = mount(getRenderingParameterPowershellTool);

        const byId = await tool.call("presentation-get-rendering-parameter", { id: "{ABC}", database: "master", renderingUniqueId: "{U}" });
        expect(byId.call!.command).toContain("-Id '{ABC}' -Database 'master' -UniqueId '{U}'");
        // Doubled quotes: the message is embedded as a PowerShell single-quoted literal.
        expect(byId.call!.command).toContain("the item with ID ''{ABC}'' in database ''master''");

        const byPath = await tool.call("presentation-get-rendering-parameter", { path: "/sitecore/content/Home", renderingUniqueId: "{U}" });
        expect(byPath.call!.command).toContain("-Path '/sitecore/content/Home' -UniqueId '{U}'");
        expect(byPath.call!.command).toContain("the item at path ''/sitecore/content/Home''");
        expect(byPath.call!.command).not.toContain("-Database");
    });

    it("security-set-item-acl pipes the addressed item into Set-ItemAcl", async () => {
        const tool = mount(setItemAclPowerShellTool);
        const common = { identity: "sitecore\\admin", accessRight: "item:read", propagationType: "Entity", securityPermission: "AllowAccess", database: "master" };

        const byId = await tool.call("security-set-item-acl", { ...common, id: "{ABC}" });
        expect(byId.call!.command).toContain("Get-Item -Id '{ABC}' -Path 'master:' | Set-ItemAcl -AccessRules $acl");

        const byPath = await tool.call("security-set-item-acl", { ...common, path: "/sitecore/content/Home" });
        expect(byPath.call!.command).toContain("Get-Item -Path '/sitecore/content/Home' | Set-ItemAcl -AccessRules $acl");
    });

    it("provider-get-item picks one of four addressing modes", async () => {
        const tool = mount(getItemPowerShellTool);

        expect((await tool.call("provider-get-item", { path: "/sitecore/content/Home" })).call!.options)
            .toEqual({ Path: "/sitecore/content/Home" });
        expect((await tool.call("provider-get-item", { id: "{ABC}" })).call!.options)
            .toEqual({ ID: "{ABC}", Path: "master:" });
        expect((await tool.call("provider-get-item", { query: "/sitecore/content/home/*" })).call!.options)
            .toEqual({ Query: "/sitecore/content/home/*", Path: "master:" });
        expect((await tool.call("provider-get-item", { uri: "sitecore://master/home" })).call!.options)
            .toEqual({ Uri: "sitecore://master/home", Path: "master:" });
        // The drive an ID resolves against follows the database parameter.
        expect((await tool.call("provider-get-item", { id: "{ABC}", database: "web" })).call!.options)
            .toEqual({ ID: "{ABC}", Path: "web:", Database: "web" });
    });
});

describe("tools that address two things at once", () => {
    it("presentation-add-rendering validates the item and the rendering separately", async () => {
        const tool = mount(addRenderingPowershellTool);

        const noRendering = await tool.call("presentation-add-rendering", { id: "{ABC}", placeHolder: "main", database: "master" });
        expect(noRendering.result.isError).toBe(true);
        expect(noRendering.result.content[0].text).toContain("'renderingId' or 'renderingPath'");

        const noItem = await tool.call("presentation-add-rendering", { renderingId: "{R}", placeHolder: "main", database: "master" });
        expect(noItem.result.isError).toBe(true);
        expect(noItem.result.content[0].text).toContain("'id' or 'path'");

        // The combination neither variant tool could express: item by path, rendering by ID.
        const mixed = await tool.call("presentation-add-rendering", {
            path: "/sitecore/content/Home", renderingId: "{R}", placeHolder: "main", database: "master",
        });
        expect(mixed.call!.command).toContain("New-Rendering -Id '{R}' -Database 'master'");
        expect(mixed.call!.command).toContain("Add-Rendering -Instance $rendering");
        expect(mixed.call!.command).toContain("-Path '/sitecore/content/Home' -Placeholder 'main'");
    });

    it("presentation-set-layout addresses the item and the layout", async () => {
        const tool = mount(setLayoutPowershellTool);

        const byIds = await tool.call("presentation-set-layout", { id: "{ABC}", layoutId: "{L}", database: "master" });
        expect(byIds.call!.command).toContain("Get-Item -Path 'master:' -Id '{L}'");
        expect(byIds.call!.command).toContain("Set-Layout -Id '{ABC}'");

        const byPaths = await tool.call("presentation-set-layout", {
            path: "/sitecore/content/Home", layoutPath: "master:/sitecore/layout/Layouts/Headless Layout", database: "master",
        });
        expect(byPaths.call!.command).toContain("Get-Item -Path 'master:/sitecore/layout/Layouts/Headless Layout'");
        expect(byPaths.call!.command).toContain("Set-Layout -Path '/sitecore/content/Home'");
    });

    it("presentation-switch-rendering keeps the uniqueId branch free of the Where-Object guard", async () => {
        const tool = mount(switchRenderingPowershellTool);

        const byUniqueId = await tool.call("presentation-switch-rendering", {
            id: "{ABC}", uniqueId: "{U}", newRenderingId: "{NEW}", database: "master",
        });
        expect(byUniqueId.call!.command).toContain("New-Rendering -Id '{NEW}' -Database 'master'");
        expect(byUniqueId.call!.command).toContain("Switch-Rendering -NewRendering $targetRendering");
        expect(byUniqueId.call!.command).toContain("-Id '{ABC}' -Database 'master' -UniqueId '{U}'");
        // SPE resolves -UniqueId itself, so there is no Where-Object selection to guard —
        // but the branch does diff the rendering list around the switch (SPE regenerates
        // the uniqueId, so the new id has to be read back and returned), and it fails
        // loudly when the diff is empty because SPE silently no-ops on an unknown id.
        expect(byUniqueId.call!.command).not.toContain("Where-Object { $_.ItemID");
        expect(byUniqueId.call!.command).toContain("$switchedRenderings");
        expect(byUniqueId.call!.command).toContain("Switch-Rendering changed nothing");

        const byOldId = await tool.call("presentation-switch-rendering", {
            id: "{ABC}", oldRenderingId: "{OLD}", newRenderingId: "{NEW}", database: "master",
        });
        expect(byOldId.call!.command).toContain("Where-Object { $_.ItemID -ceq '{OLD}' }");
        expect(byOldId.call!.command).toContain("Write-Error");
        expect(byOldId.call!.command).toContain("foreach($sourceRendering in $sourceRenderings)");

        const byOldPath = await tool.call("presentation-switch-rendering", {
            path: "/sitecore/content/Home", oldRenderingPath: "/sitecore/layout/Renderings/Old", newRenderingPath: "/sitecore/layout/Renderings/New",
        });
        expect(byOldPath.call!.command).toContain("$oldRendering = Get-Item -Path '/sitecore/layout/Renderings/Old'");
        expect(byOldPath.call!.command).toContain("Where-Object { $_.ItemID -ceq $oldRendering.ID.ToString() }");
        expect(byOldPath.call!.command).toContain("New-Rendering -Path '/sitecore/layout/Renderings/New'");

        const threeOld = await tool.call("presentation-switch-rendering", {
            id: "{ABC}", uniqueId: "{U}", oldRenderingId: "{OLD}", newRenderingId: "{NEW}",
        });
        expect(threeOld.result.isError).toBe(true);
        expect(threeOld.result.content[0].text).toContain("'uniqueId', 'oldRenderingId' or 'oldRenderingPath'");
    });
});
