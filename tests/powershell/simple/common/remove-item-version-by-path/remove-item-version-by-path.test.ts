import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../../client";
import { seedScratch, ensureLanguage } from "../../../../fixtures";

await client.connect(transport);

// Only `en` is guaranteed on a CM, so the second language is part of the fixture. It is
// removed again only if this run is what added it.
const scratch = await seedScratch("remove-item-version-by-path", ["Target", "Numbered"]);
const language = await ensureLanguage("es-ES");
afterAll(async () => {
    await scratch.cleanup();
    await language.remove();
});

describe("powershell", () => {
    it("common-remove-item-version-language", async () => {
        // Arrange: a version to remove, in a language that is not the item's own.
        const target = scratch.item("Target").path;
        await callTool(client, "common-add-item-version", {
            path: target,
            language: "en",
            targetLanguage: "es-ES",
        });

        // Act
        await callTool(client, "common-remove-item-version", { path: target, language: "es-ES" });

        // Assert
        const result = await callTool(client, "provider-get-item", { path: target, language: "es-ES" });
        expect(JSON.parse(result.content[0].text).Obj).toBeUndefined();
    });

    it("common-remove-item-version-number", async () => {
        // Arrange: two versions, so removing one by number leaves the other behind.
        const target = scratch.item("Numbered").path;
        await callTool(client, "common-add-item-version", { path: target, language: "en", targetLanguage: "es-ES" });
        await callTool(client, "common-add-item-version", { path: target, language: "es-ES", targetLanguage: "es-ES" });

        const both = await callTool(client, "provider-get-item", { path: target, language: "es-ES", version: "2" });
        expect(JSON.parse(both.content[0].text).Obj).toBeDefined();

        // Act
        await callTool(client, "common-remove-item-version", { path: target, language: "es-ES", version: "2" });

        // Assert
        const removed = await callTool(client, "provider-get-item", { path: target, language: "es-ES", version: "2" });
        expect(JSON.parse(removed.content[0].text).Obj).toBeUndefined();

        const kept = await callTool(client, "provider-get-item", { path: target, language: "es-ES", version: "1" });
        expect(JSON.parse(kept.content[0].text).Obj).toBeDefined();
    });
});
