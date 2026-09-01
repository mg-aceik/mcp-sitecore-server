import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../../../client";
import { seedScratch, ensureLanguage } from "../../../../fixtures";

await client.connect(transport);

// Only `en` is guaranteed on a CM, so the second language is part of the fixture. It is
// removed again only if this run is what added it.
const scratch = await seedScratch("add-item-version-by-path", ["Target"]);
const language = await ensureLanguage("fr-CA");
afterAll(async () => {
    await scratch.cleanup();
    await language.remove();
});

describe("powershell", () => {
    it("common-add-item-version", async () => {
        // Arrange
        const target = scratch.item("Target").path;
        const before = await callTool(client, "provider-get-item", { path: target, language: "fr-CA" });
        expect(JSON.parse(before.content[0].text).Obj).toBeUndefined();

        // Act
        await callTool(client, "common-add-item-version", {
            path: target,
            language: "en",
            targetLanguage: "fr-CA",
        });

        // Assert
        const after = await callTool(client, "provider-get-item", { path: target, language: "fr-CA" });
        const json = JSON.parse(after.content[0].text);
        expect(json.Obj).toBeDefined();
        expect(json.Obj[0].Language).toBe("fr-CA");
    });
});
