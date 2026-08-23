import { describe, it, expect } from "vitest";
import { client, transport, callTool } from "../../../../client";

await client.connect(transport);

describe("powershell", () => {
    it("security-test-item-acl", async () => {
        const args: Record<string, any> = {
            path: "/sitecore/content/Home/Tests/Security/Test-Item-ACL/Test-Item-ACL-By-Path",
            identity: "sitecore\\Author",
            accessRight: "item:write"
        };

        const result = await callTool(client, "security-test-item-acl", args);
        const json = JSON.parse(result.content[0].text);

        expect(json).toMatchObject(
            {
                Obj: [
                    false,
                ],
            }
        );
    });
});