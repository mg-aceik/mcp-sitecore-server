import { describe, it, expect } from "vitest";
import { callTool } from "@modelcontextprotocol/inspector/cli/build/client/tools.js";
import { client, transport } from "../../../client";
import { getCurrentLayoutId } from "../../tools/get-current-layout-id";

await client.connect(transport);

// /sitecore/content/Home/Tests/Presentation/Reset-Layout-By-Path
const itemId = "{C4E97DA7-4C43-44E8-AFBB-B1B634BEB022}";
const itemPath = "master:/sitecore/content/Home/Tests/Presentation/Reset-Layout-By-Path";

// /sitecore/layout/Layouts/Sample Layout
const sampleLayoutId = "{14030E9F-CE92-49C6-AD87-7D49B50E42EA}";

// /sitecore/layout/Layouts/Feature/Tests/Reset-Layout/InitialLayout
const initialLayoutId = "{C088204D-9C63-4A70-8846-D7233D660B0A}";

const finalLayout = "true";
const language = "ja-jp";

describe("powershell", () => {
    it("presentation-reset-layout", async () => {
        // Arrange
        const initialSetUpArgs: Record<string, any> = {
            id: itemId,
            layoutId: initialLayoutId,
            layoutPath: "master:",
            language,
            finalLayout,
        };

        // Initialize item initial state before test.
        await callTool(client, "presentation-set-layout", initialSetUpArgs);

        // Assert the test item has been initialized correctly before test.
        const currentLayoutId = await getCurrentLayoutId(client, itemId);
        expect(currentLayoutId.toLowerCase()).toBe(initialLayoutId.toLowerCase());

        const resetLayoutArgs: Record<string, any> = {
            path: itemPath,
            finalLayout,
            language,
        };
    
        // Act
        await callTool(client, "presentation-reset-layout", resetLayoutArgs);

        // Assert
        const resultLayoutId = await getCurrentLayoutId(client, itemId);
        expect(resultLayoutId.toLowerCase()).toBe(sampleLayoutId.toLowerCase());
    });
});