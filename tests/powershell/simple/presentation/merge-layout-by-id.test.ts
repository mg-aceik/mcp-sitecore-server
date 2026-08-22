import { describe, it, expect } from "vitest";
import { callTool } from "@modelcontextprotocol/inspector/cli/build/client/tools.js";
import { client, transport } from "../../../client";
import { getCurrentLayoutId } from "../../tools/get-current-layout-id";
import { resetLayoutById } from "../../tools/reset-layout";

await client.connect(transport);

// /sitecore/content/Home/Tests/Presentation/Reset-Layout-By-Id
const itemId = "{CCBB4F6D-C64E-44A6-832D-66FECCA146ED}";

// /sitecore/layout/Layouts/Feature/Tests/Merge-Layout/Layout
const layoutId = "{A51BF5C0-CD68-48A5-884B-1BD4BD08D57C}";

const database = "master";
const language = "ja-jp";

describe("powershell", () => {
    it("presentation-merge-layout", async () => {
        // Arrange
        // Reset layout to ensure we have correct initial state before test.
        // reset shared layout
        await resetLayoutById(client, itemId, database, undefined, "false");
        // reset final layout
        await resetLayoutById(client, itemId, database, language, "true");

        // Set initial layout before test.
        const setLayoutArgs: Record<string, any> = {
            id: itemId,
            layoutId: layoutId,
            layoutPath: "master:",
            language,
            finalLayout: "true",
        };

        // Initialize item initial state before test.
        await callTool(client, "presentation-set-layout", setLayoutArgs);

        const currentLayoutId = await getCurrentLayoutId(client, itemId, "true", "ja-jp");
        expect(currentLayoutId.toLowerCase()).toBe(layoutId.toLowerCase());

        const mergeLayoutArgs: Record<string, any> = {
            id: itemId,
            database,
            language,
        };

        // Act
        await callTool(client, "presentation-merge-layout", mergeLayoutArgs);

        // Assert
        const assertLayoutId = await getCurrentLayoutId(client, itemId, "false");
        expect(assertLayoutId.toLowerCase()).toBe(layoutId.toLowerCase());
    });
});