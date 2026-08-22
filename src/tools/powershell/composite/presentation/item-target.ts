import { z } from "zod";
import { hasTarget } from "@/tools/target-input.js";

/**
 * Addressing for the item that holds a rendering.
 *
 * The composite presentation tools all run `Get-Rendering` (and often `Set-Rendering`)
 * against one item, and before Tier 2 the tool name fixed how that item was named. The
 * merged tools take `id` or `path` and branch here, so that each branch sends exactly what
 * its own tool sent: the ID form passed `-Database`, the path form never did — a path
 * carries its own `db:` prefix.
 */

const DATABASE_DESCRIPTION =
    "The context database. Only sent when addressing by id -- a path carries its own "
    + "database prefix (e.g. master:/sitecore/content/Home).";

/** The `id` / `path` / `database` inputs for a tool that acts on the renderings of an item. */
export const renderingItemTargetInputSchema = {
    id: z.string().optional()
        .describe("The ID of the item holding the rendering. Supply this or path."),
    path: z.string().optional()
        .describe("The path of the item holding the rendering. Supply this or id."),
    database: z.string().describe(DATABASE_DESCRIPTION).optional().default("master"),
};

export type ItemTarget = {
    id?: string;
    path?: string;
    database?: string;
};

/** The cmdlet parameters that address the item, one branch per addressing input. */
export function itemTargetParameters(target: ItemTarget): Record<string, any> {
    if (hasTarget(target.id)) {
        return { "Id": target.id, "Database": target.database };
    }
    return { "Path": target.path };
}

/**
 * How the item reads in a "not found" message. Each branch keeps the wording its own tool
 * used, because the database is only part of the answer when the caller named an ID.
 */
export function itemTargetDescription(target: ItemTarget): string {
    return hasTarget(target.id)
        ? `the item with ID '${target.id}' in database '${target.database}'`
        : `the item at path '${target.path}'`;
}
