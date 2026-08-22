import { describe, it, expect } from "vitest";
import { callTool } from "@modelcontextprotocol/inspector/cli/build/client/tools.js";
import { client, transport } from "../../../client";

await client.connect(transport);

// /sitecore/content/Home/Tests/Presentation/Get-Rendering-Parameter-By-Id
const itemId = "{968F73D2-B5AC-4A26-BB96-AF32AEA8C7DE}";

const uniqueId = "{B343725A-3A93-446E-A9C8-3A2CBD3DB489}";
const database = "master";
const finalLayout = "true";
const language = "ja-jp";
const name = "sample";

describe("powershell", () => {
    it("presentation-get-rendering-parameter", async () => {
        // Arrange
        const getRenderingParameterArgs: Record<string, any> =
        {
            id: itemId,
            renderingUniqueId: uniqueId,
            name,
            database,
            finalLayout,
            language,
        };

        // Act
        const result = await callTool(client, "presentation-get-rendering-parameter", getRenderingParameterArgs);

        // Assert
        const json = JSON.parse(result.content[0].text);
        const testObject = json.Obj[0];
        expect(testObject.En.Key).toBe(name);
        expect(testObject.En.Value).toBe("value");
    });
});
