import { Client } from "@modelcontextprotocol/client";
import { callTool } from "../../client";

export async function getRenderingById(
    client: Client,
    itemId: string,
    database: string,
    uniqueId: string | undefined,    
    language: string | undefined,
    finalLayout: boolean | undefined
) : Promise<any>
{
    const getRenderingsArgs: Record<string, any> = {
        id: itemId,
        uniqueId,
        database,
        language,
        finalLayout,
    };

    const result = await callTool(client, "presentation-get-rendering", getRenderingsArgs);
    
    return getRenderingObject(result.content[0].text);
}

export async function getRenderingByPath(
    client: Client,
    path: string,
    uniqueId: string | undefined,    
    language: string | undefined,
    finalLayout: boolean | undefined
) : Promise<any>
{
    const getRenderingsArgs: Record<string, any> = {
        path,
        uniqueId,
        language,
        finalLayout,
    };

    const result = await callTool(client, "presentation-get-rendering", getRenderingsArgs);

    return getRenderingObject(result.content[0].text);
}

function getRenderingObject(responseString: string)
{
    const resultJson = JSON.parse(responseString);    
    if (!resultJson.Obj)
    {
        return undefined;
    }

    return resultJson.Obj;
}
