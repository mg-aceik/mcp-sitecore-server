import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../../client";

await client.connect(transport);
describe("powershell", () => {
    /**
     * This used to search `title_t_en` for "FindItemTest" and assert the ID of a seeded
     * fixture item, which existed on one developer's CM and nowhere else -- so it failed on
     * every other instance with "No items found." and told you nothing about the tool.
     *
     * The Sitecore root is the fixture every instance already has: item ID
     * {11111111-1111-1111-1111-111111111111} is fixed across every Sitecore ever installed,
     * it is in the master index without anyone seeding it, and it needs no write and no
     * wait for a crawl. The assertion looks for it *among* the results rather than at a
     * fixed position, because several items are named "sitecore" and the index does not
     * promise an order.
     */
    it("indexing-find-item", async () => {
        const SITECORE_ROOT_ID = "{11111111-1111-1111-1111-111111111111}";

        const result = await callTool(client, "indexing-find-item", {
            index: "sitecore_master_index",
            criteria: [
                {
                    filter: "Equals",
                    field: "_name",
                    value: "sitecore"
                }
            ],
            first: 10,
            skip: 0
        });

        expect(result.isError).not.toBe(true);
        const json = JSON.parse(result.content[0].text);
        const ids = json.Items.map((item: any) => String(item.ItemId).toLowerCase());
        expect(ids).toContain(SITECORE_ROOT_ID);

        // The row carries the identity an agent needs to make its next call, and the
        // criterion field is projected alongside it.
        const root = json.Items.find(
            (item: any) => String(item.ItemId).toLowerCase() === SITECORE_ROOT_ID
        );
        expect(root.Path).toBe("/sitecore");
        expect(root.TemplateName).toBe("Root");
        expect(root._name).toBe("sitecore");
    });

    /**
     * Two criteria on one field — the ordinary way to write a range — used to fail the whole
     * search. The tool projects one `Select-Object` column per criterion, so the field was
     * asked for twice, and `Select-Object` refuses a duplicate property name with a
     * non-terminating error per result row. SPE serializes the error stream into the same
     * object graph as the results, so the shared error detection found it and returned the
     * search as a failure with every hit discarded:
     *
     *   Select-Object failed: The property cannot be processed because the property
     *   "_name" already exists.
     *
     * The unit tests assert the deduplicated command string; only this one proves SPE's own
     * PowerShell host accepts what we now build. Deliberately fixture-independent — it
     * asserts the call *succeeds*, not what it matches, so a CM with no matching content
     * still guards the regression.
     */
    it("indexing-find-item: two criteria on the same field", async () => {
        const result = await callTool(client, "indexing-find-item", {
            index: "sitecore_master_index",
            criteria: [
                { filter: "Contains", field: "_name", value: "h" },
                { filter: "Contains", field: "_name", value: "o" },
            ],
            first: 5,
            skip: 0,
        });

        expect(result.isError).not.toBe(true);
        expect(result.content[0].text).not.toContain("already exists");
    });

    // `HasMore` is the answer to a question `Find-Item` cannot answer directly: the Content
    // Search API returns no total, so without this an agent cannot tell a full page from the
    // end of the results.
    it("indexing-find-item: reports HasMore against a real index", async () => {
        const result = await callTool(client, "indexing-find-item", {
            index: "sitecore_master_index",
            criteria: [{ filter: "Contains", field: "_name", value: "e" }],
            first: 2,
            skip: 0,
        });

        expect(result.isError).not.toBe(true);
        const json = JSON.parse(result.content[0].text);
        expect(json.First).toBe(2);
        expect(json.Skip).toBe(0);
        expect(Array.isArray(json.Items)).toBe(true);
        // The extra probe row must never reach the caller.
        expect(json.Items.length).toBeLessThanOrEqual(2);
        expect(json.Returned).toBe(json.Items.length);
        expect(typeof json.HasMore).toBe("boolean");
    });

    it("indexing-find-item: a date range across two criteria on one field", async () => {
        const result = await callTool(client, "indexing-find-item", {
            index: "sitecore_master_index",
            criteria: [
                { filter: "GreaterThan", field: "__smallcreateddate_tdt", value: "2000-01-01T00:00:00Z" },
                { filter: "LessThan", field: "__smallcreateddate_tdt", value: "2030-01-01T00:00:00Z" },
            ],
            first: 5,
            skip: 0,
        });

        expect(result.isError).not.toBe(true);
        expect(result.content[0].text).not.toContain("already exists");
    });
});

