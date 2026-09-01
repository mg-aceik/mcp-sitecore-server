import { describe, it, expect, afterAll } from "vitest";
import { client, transport, callTool } from "../../client";
import { ensureLanguage } from "../../fixtures";

await client.connect(transport);

// Only `en` is guaranteed on a CM. The second language is this test's own, so the tool has
// more than one row to return whatever the instance ships with.
const language = await ensureLanguage("da-DK");
afterAll(() => language.remove());

describe("item-service", () => {
    it("item-service-get-languages", async () => {
        const result = await callTool(client, "item-service-get-languages", {});
        const languages = JSON.parse(result.content[0].text);

        const names = languages.map((entry: any) => entry.ItemName);
        expect(names).toEqual(expect.arrayContaining(["en", "da-DK"]));

        const english = languages.find((entry: any) => entry.ItemName === "en");
        expect(english.ItemPath).toBe("/sitecore/system/Languages/en");
        expect(english.TemplateName).toBe("Language");
        expect(english.ItemLanguage).toBe("en");
        expect(english.ItemIcon).toEqual(expect.any(String));
    });
});
