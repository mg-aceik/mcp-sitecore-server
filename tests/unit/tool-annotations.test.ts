import { describe, it, expect } from "vitest";
import { inferToolAnnotations } from "../../src/tool-annotations";

describe("inferToolAnnotations", () => {
    it("marks get-* tools as read-only", () => {
        const a = inferToolAnnotations("common-get-item-field");
        expect(a.readOnlyHint).toBe(true);
        expect(a.destructiveHint).toBeUndefined();
    });

    it("marks query/introspection tools as read-only", () => {
        expect(inferToolAnnotations("query-graphql-master").readOnlyHint).toBe(true);
        expect(inferToolAnnotations("introspection-graphql-edge").readOnlyHint).toBe(true);
    });

    it("marks delete/remove tools as destructive", () => {
        const del = inferToolAnnotations("item-service-delete-item");
        expect(del.readOnlyHint).toBe(false);
        expect(del.destructiveHint).toBe(true);

        const rem = inferToolAnnotations("common-remove-item-version");
        expect(rem.destructiveHint).toBe(true);
    });

    it("marks set/add/new tools as non-destructive writes", () => {
        const set = inferToolAnnotations("presentation-set-layout");
        expect(set.readOnlyHint).toBe(false);
        expect(set.destructiveHint).toBe(false);
    });

    // These four verbs were in neither token set, so every tool named with one inferred
    // readOnlyHint: true -- an auto-permitted mutation. tool-annotation-sweep.test.ts
    // guards the registered surface; this guards the rule.
    it("treats move/copy/rename/rebuild as writes, not reads", () => {
        for (const name of [
            "authoring-move-item",
            "authoring-copy-item",
            "authoring-rename-item",
            "authoring-rebuild-indexes",
        ]) {
            const a = inferToolAnnotations(name);
            expect(a.readOnlyHint, name).toBe(false);
            expect(a.destructiveHint, name).toBe(false);
        }
    });

    it("does not treat unlock/unprotect as destructive (token, not substring, match)", () => {
        expect(inferToolAnnotations("security-unlock-item").destructiveHint).toBe(false);
        expect(inferToolAnnotations("security-unprotect-item").destructiveHint).toBe(false);
    });

    it("marks run-powershell-script as destructive and open-world", () => {
        const a = inferToolAnnotations("run-powershell-script");
        expect(a.readOnlyHint).toBe(false);
        expect(a.destructiveHint).toBe(true);
        expect(a.openWorldHint).toBe(true);
    });

    // The inverse of what this test used to assert. A title derived from the tool name
    // restates a field the client already has, and it was costing ~4,800 characters of
    // every tools/list -- paid on every turn -- across 134 tools. Tools whose title is
    // genuinely more than the name set it explicitly in their own config, which
    // withInferredAnnotations does not overwrite.
    it("infers no title, leaving it to the client or an explicit config", () => {
        expect(inferToolAnnotations("common-get-archive").title).toBeUndefined();
    });

    it("still infers the hints every tool needs", () => {
        const a = inferToolAnnotations("common-get-archive");
        expect(a.readOnlyHint).toBe(true);
        expect(Object.keys(a)).toEqual(["readOnlyHint"]);
    });
});
