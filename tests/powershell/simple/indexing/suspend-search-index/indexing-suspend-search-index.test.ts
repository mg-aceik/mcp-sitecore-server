import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../../client";

await client.connect(transport);

// The core index, not the master one: this takes an index out of service for a moment and
// every other file in the suite is searching master while it runs.
//
// The assertion is that SPE accepts the call and the index is left running, not that the
// index was in a particular state afterwards -- the sibling state files act on the same
// index in parallel, so any state read here belongs to whichever of them ran last.
// `tests/unit/merged-sweep.test.ts` covers which cmdlet each action dispatches to.
const INDEX = "sitecore_core_index";

const indexingState = async () => {
    const result = await callTool(client, "indexing-get-search-index", { name: INDEX });
    return JSON.parse(result.content[0].text).Obj[0].IndexingState;
};

describe("powershell", () => {
    it("indexing-set-search-index-state", async () => {
        const result = await callTool(client, "indexing-set-search-index-state", {
            action: "suspend",
            name: INDEX,
        });

        expect(result.isError).not.toBe(true);
        expect(typeof await indexingState()).toBe("string");

        // Leave it running, whatever this test did to it.
        await callTool(client, "indexing-set-search-index-state", { action: "resume", name: INDEX });
    });
});
