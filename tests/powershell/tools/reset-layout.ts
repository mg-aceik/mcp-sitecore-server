import { Client } from "@modelcontextprotocol/client";
import { callTool } from "../../client";

export async function resetLayoutById(
    client: Client,
    itemId: string,
    database: string,
    language: string | undefined,
    finalLayout: string) {
    const resetLayoutArgs: Record<string, any> = {
        id: itemId,
        database,
        language,
        finalLayout,            
    };

    await callTool(client, "presentation-reset-layout", resetLayoutArgs);
};

export async function resetLayoutByPath(
    client: Client,
    itemPath: string,
    language: string | undefined,
    finalLayout: string) {
    const resetLayoutArgs: Record<string, any> = {
        path: itemPath,
        language,
        finalLayout,            
    };

    await callTool(client, "presentation-reset-layout", resetLayoutArgs);
};
