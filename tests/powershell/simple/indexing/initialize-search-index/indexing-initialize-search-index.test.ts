import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../../client";

await client.connect(transport);

// Rebuilding a whole index needs no fixture -- the index is what is under test -- but it
// does need an index every CM has. Core rather than master: a master rebuild empties the
// index that the find-item and item-scoped rebuild tests are searching while it runs.
const INDEX = "sitecore_core_index";

describe("powershell", () => {
    it("indexing-rebuild-search-index", async () => {
        const result = await callTool(client, "indexing-rebuild-search-index", { name: INDEX });
        expect(result.isError).not.toBe(true);

        const status = await callTool(client, "indexing-get-search-index", { name: INDEX });
        const index = JSON.parse(status.content[0].text).Obj[0];

        expect(index.Name).toBe(INDEX);
        expect(index.IsInitialized).toBe(true);
        // Not "LastUpdated moved": the sibling state files suspend and resume this same
        // index in parallel, and a suspended index does not finish its rebuild while they
        // hold it. That the rebuild was accepted and the index still reports a timestamp is
        // what this can assert without depending on the order files happen to run in.
        expect(Number.isNaN(new Date(index.LastUpdated).getTime())).toBe(false);
    });
});
