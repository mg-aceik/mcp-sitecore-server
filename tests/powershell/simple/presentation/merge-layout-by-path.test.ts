import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../client";
import { getCurrentLayoutId } from "../../tools/get-current-layout-id";
import { resetLayoutByPath } from "../../tools/reset-layout";

await client.connect(transport);

const path = "master:/sitecore/content/Home/Tests/Presentation/Merge-Layout-By-Path";

// /sitecore/content/Home/Tests/Presentation/Merge-Layout-By-Path
const itemId = "{CAAC0E1C-66C1-480F-AA26-89C327DF84D8}";

// /sitecore/layout/Layouts/Feature/Tests/Merge-Layout/Layout
const layoutId = "{A51BF5C0-CD68-48A5-884B-1BD4BD08D57C}";

const language = "ja-jp";

describe("powershell", () => {
    it("presentation-merge-layout", async () => {
        // Arrange
        // Reset layout to ensure we have correct initial state before test.
        // reset shared layout
        await resetLayoutByPath(client, path, undefined, false);
        // reset final layout
        await resetLayoutByPath(client, path, language, true);

        // Set initial layout before test.
        const setLayoutArgs: Record<string, any> = {
            id: itemId,
            layoutId: layoutId,
            layoutPath: "master:",
            language,
            finalLayout: true,
        };

        // Initialize item initial state before test.
        await callTool(client, "presentation-set-layout", setLayoutArgs);

        const currentLayoutId = await getCurrentLayoutId(client, itemId, true, "ja-jp");
        expect(currentLayoutId.toLowerCase()).toBe(layoutId.toLowerCase());

        const mergeLayoutArgs: Record<string, any> = {
            path,
            language,
        };

        // Act
        await callTool(client, "presentation-merge-layout", mergeLayoutArgs);

        // Assert
        const assertLayoutId = await getCurrentLayoutId(client, itemId, false);
        expect(assertLayoutId.toLowerCase()).toBe(layoutId.toLowerCase());
    });
});