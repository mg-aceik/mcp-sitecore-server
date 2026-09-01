import { describe, it, expect } from "vitest";
import {
    describeTargetInputs,
    requireOneTarget,
    suppliedTargets,
} from "../../src/tools/target-input";

describe("describeTargetInputs", () => {
    it("reads as prose for two and for four inputs", () => {
        expect(describeTargetInputs(["id", "path"])).toBe("'id' or 'path'");
        expect(describeTargetInputs(["path", "id", "query", "uri"]))
            .toBe("'path', 'id', 'query' or 'uri'");
    });
});

describe("suppliedTargets", () => {
    it("ignores undefined, null and blank strings", () => {
        expect(suppliedTargets({ id: undefined, path: null, query: "", uri: "   " }, ["id", "path", "query", "uri"]))
            .toEqual([]);
    });

    it("reports the inputs in the order the tool declares them", () => {
        expect(suppliedTargets({ path: "/sitecore", id: "{A}" }, ["id", "path"])).toEqual(["id", "path"]);
    });
});

describe("requireOneTarget", () => {
    it("passes exactly one input through", () => {
        expect(requireOneTarget({ id: "{A}" }, ["id", "path"])).toBeUndefined();
        expect(requireOneTarget({ path: "/sitecore/content/Home" }, ["id", "path"])).toBeUndefined();
    });

    it("names the valid inputs when none was supplied", () => {
        const error = requireOneTarget({}, ["id", "path"])!;
        expect(error.isError).toBe(true);
        const text = error.content[0].text as string;
        expect(text).toContain("Supply exactly one of 'id' or 'path'");
        expect(text).toContain("None was supplied");
    });

    it("says which two were supplied rather than silently picking one", () => {
        const error = requireOneTarget({ id: "{A}", path: "/sitecore" }, ["id", "path"])!;
        const text = error.content[0].text as string;
        expect(text).toContain("2 were supplied ('id', 'path')");
        expect(text).toContain("one call cannot mean two items");
    });

    it("handles a three-way union", () => {
        const names = ["uniqueId", "oldRenderingId", "oldRenderingPath"];
        expect(requireOneTarget({ uniqueId: "{U}" }, names)).toBeUndefined();
        const error = requireOneTarget({ uniqueId: "{U}", oldRenderingPath: "/x", oldRenderingId: "{O}" }, names)!;
        expect(error.content[0].text as string).toContain("3 were supplied");
    });

    it("accepts a non-string target, since not every addressing input is text", () => {
        expect(requireOneTarget({ id: 0 }, ["id", "path"])).toBeUndefined();
    });
});
