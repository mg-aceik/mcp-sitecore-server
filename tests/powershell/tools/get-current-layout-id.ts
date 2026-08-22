import { Client } from "@modelcontextprotocol/client";
import { callTool } from "../../client";

export async function getCurrentLayoutId(
    client: Client,
    itemId: string,
    finalLayout: string = "true",
    language: string = "ja-jp"
): Promise<string> {
    const getLayoutArgs: Record<string, any> = {
        id: itemId,
        finalLayout,
        language,
    };

    const result = await callTool(client, "presentation-get-layout", getLayoutArgs);
    const json = JSON.parse(result.content[0].text);

    return json.Obj[0].ID.ToString;
}