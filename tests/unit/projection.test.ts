import { describe, it, expect } from "vitest";
import {
    ARCHIVE_ENTRY_PROJECTION,
    ITEM_PROJECTION,
    fixedProjectionPipeline,
    itemProjectionPipeline,
    selectObjectPipeline,
} from "../../src/tools/powershell/projection";

describe("selectObjectPipeline", () => {
    it("renders calculated properties as a Select-Object stage", () => {
        expect(selectObjectPipeline([{ name: "Name", expression: "$_.Name" }]))
            .toBe(" | Select-Object @{n='Name'; e={$_.Name}}");
    });
});

describe("itemProjectionPipeline", () => {
    it("projects the default identity field set", () => {
        const pipeline = itemProjectionPipeline({});
        for (const property of ITEM_PROJECTION) {
            expect(pipeline).toContain(`@{n='${property.name}'; e={${property.expression}}}`);
        }
    });

    it("unwraps CustomItemBase wrappers (TemplateItem, DeviceItem) before projecting", () => {
        expect(itemProjectionPipeline({})).toContain("[Sitecore.Data.Items.CustomItemBase]");
    });

    it("returns undefined when full output was requested", () => {
        expect(itemProjectionPipeline({ full: true })).toBeUndefined();
        expect(itemProjectionPipeline({ full: true, fields: ["Title"] })).toBeUndefined();
    });

    it("appends requested Sitecore fields via the item indexer", () => {
        const pipeline = itemProjectionPipeline({ fields: ["Title", "NavigationTitle"] });
        expect(pipeline).toContain("@{n='Title'; e={$_['Title']}}");
        expect(pipeline).toContain("@{n='NavigationTitle'; e={$_['NavigationTitle']}}");
    });

    it("ignores blank field names and fields already in the default set", () => {
        const pipeline = itemProjectionPipeline({ fields: ["", "  ", "name", "Name"] })!;
        // "Name" is already projected; asking for it again must not duplicate the property,
        // which Select-Object would reject.
        expect(pipeline.match(/n='Name'/g)).toHaveLength(1);
    });

    it("escapes single quotes in field names so they cannot break out of the literal", () => {
        const pipeline = itemProjectionPipeline({ fields: ["it's'; Remove-Item /sitecore; '"] })!;
        expect(pipeline).toContain("@{n='it''s''; Remove-Item /sitecore; '''; e={$_['it''s''; Remove-Item /sitecore; ''']}}");
    });
});

describe("fixedProjectionPipeline", () => {
    it("projects the archive entry's own properties, not item properties", () => {
        const pipeline = fixedProjectionPipeline(ARCHIVE_ENTRY_PROJECTION, {})!;
        expect(pipeline).toContain("n='OriginalLocation'");
        expect(pipeline).not.toContain("Paths.FullPath");
    });

    it("returns undefined when full output was requested", () => {
        expect(fixedProjectionPipeline(ARCHIVE_ENTRY_PROJECTION, { full: true })).toBeUndefined();
    });
});
