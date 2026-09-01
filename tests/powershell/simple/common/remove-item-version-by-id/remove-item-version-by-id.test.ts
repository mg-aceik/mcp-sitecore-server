import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../../client";
import { seedScratch, ensureLanguage } from "../../../../fixtures";

await client.connect(transport);

// Only `en` is guaranteed on a CM, so the second language is part of the fixture. It is
// removed again only if this run is what added it.
const scratch = await seedScratch("remove-item-version-by-id", ["Target", "Numbered"]);
const language = await ensureLanguage("it-IT");
afterAll(async () => {
    await scratch.cleanup();
    await language.remove();
});

describe("powershell", () => {
    it("common-remove-item-version-language", async () => {
        // Arrange: a version to remove, in a language that is not the item's own.
        const target = scratch.item("Target").id;
        await callTool(client, "common-add-item-version", {
            id: target,
            language: "en",
            targetLanguage: "it-IT",
        });

        // Act
        await callTool(client, "common-remove-item-version", { id: target, language: "it-IT" });

        // Assert
        const result = await callTool(client, "provider-get-item", { id: target, language: "it-IT" });
        expect(JSON.parse(result.content[0].text).Obj).toBeUndefined();
    });

    it("common-remove-item-version-number", async () => {
        // Arrange: two versions, so removing one by number leaves the other behind.
        const target = scratch.item("Numbered").id;
        await callTool(client, "common-add-item-version", { id: target, language: "en", targetLanguage: "it-IT" });
        await callTool(client, "common-add-item-version", { id: target, language: "it-IT", targetLanguage: "it-IT" });

        const both = await callTool(client, "provider-get-item", { id: target, language: "it-IT", version: "2" });
        expect(JSON.parse(both.content[0].text).Obj).toBeDefined();

        // Act
        await callTool(client, "common-remove-item-version", { id: target, language: "it-IT", version: "2" });

        // Assert
        const removed = await callTool(client, "provider-get-item", { id: target, language: "it-IT", version: "2" });
        expect(JSON.parse(removed.content[0].text).Obj).toBeUndefined();

        const kept = await callTool(client, "provider-get-item", { id: target, language: "it-IT", version: "1" });
        expect(JSON.parse(kept.content[0].text).Obj).toBeDefined();
    });
});
