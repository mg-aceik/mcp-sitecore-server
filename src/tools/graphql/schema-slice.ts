import { z } from "zod";
import {
    type GraphQLArgument,
    type GraphQLField,
    type GraphQLNamedType,
    type GraphQLSchema,
    getNamedType,
    isEnumType,
    isInputObjectType,
    isObjectType,
    isScalarType,
    printSchema,
    printType,
} from "graphql";

/**
 * Progressive disclosure for GraphQL introspection.
 *
 * Both introspection tools used to return the whole printed SDL and took no arguments at
 * all, so there was no way to ask for less. Measured against a live CM:
 *
 * - `introspection-graphql-edge` returned **777,501 characters** — roughly 194,000 tokens,
 *   which exceeds most context windows outright, so the tool could not be used by an agent
 *   at any budget. 66% of it was descriptions, and of those only 14% were distinct: one
 *   sentence appeared 597 times. A further 21% was GUID-suffixed duplicate types, 26 of
 *   which had a near-identical friendly-named twin. Meanwhile the entire queryable surface
 *   is four root fields, and every field of every item is reachable through one generic
 *   `Item` interface — about 1.2 KB of actual contract.
 * - `authoring-introspect-schema` returned **117,188 characters** (~29,000 tokens). That
 *   schema is the opposite case: 324 definitions averaging 362 characters, descriptions 74%
 *   distinct, and 127 root operations of which only ~20 have a typed tool. Its content is
 *   load-bearing, so it is sliced rather than replaced.
 *
 * This is the same shape `get-powershell-documentation` already uses on this server, which
 * went from returning a ~570 KB corpus to a 13 KB index plus on-demand pages: no arguments
 * returns an index, and a named lookup returns one entry in full.
 */

const TYPE_DESCRIPTION =
    "Return the full definition of one named type, or of one root operation (e.g. "
    + "'ArticlePage', 'createUser'). For an operation, the input and enum types its "
    + "arguments reference are included too, so the result is enough to write the document. "
    + "This is the argument to reach for once the index has told you the name.";

const SEARCH_DESCRIPTION =
    "Find types and operations whose name or description matches this keyword (e.g. "
    + "'media', 'workflow', 'publish'). Returns names and one-line summaries, not full "
    + "definitions.";

const FULL_DESCRIPTION =
    "When true, return the entire schema SDL. Very large — see the tool description for the "
    + "measured size — so prefer 'type' or 'search'. Combine with includeDescriptions:false "
    + "to cut it substantially.";

const INCLUDE_DESCRIPTIONS_DESCRIPTION =
    "When false, strip all docstrings from the output. Defaults to true.";

/**
 * Raw zod shape fragment to spread into an introspection tool's `inputSchema`.
 */
export const schemaSliceInputSchema = {
    type: z.string().optional().describe(TYPE_DESCRIPTION),
    search: z.string().optional().describe(SEARCH_DESCRIPTION),
    full: z.boolean().optional().describe(FULL_DESCRIPTION),
    includeDescriptions: z.boolean().optional().describe(INCLUDE_DESCRIPTIONS_DESCRIPTION),
};

export type SchemaSliceParams = {
    type?: string;
    search?: string;
    full?: boolean;
    includeDescriptions?: boolean;
};

/**
 * Strips block-string docstrings from printed SDL.
 *
 * `printSchema` has no option to omit descriptions, and rebuilding a description-free copy
 * of the schema is far more code than removing them from its output. `printSchema` always
 * emits them as `"""`-delimited blocks on their own lines, so this is safe on its output —
 * it is not a general-purpose SDL parser and is only ever applied to text this module
 * printed.
 */
function stripDescriptions(sdl: string): string {
    return sdl
        .replace(/^[ \t]*"""[\s\S]*?"""[ \t]*\r?\n/gm, "")
        .replace(/\n{3,}/g, "\n\n");
}

function applyDescriptions(sdl: string, params: SchemaSliceParams): string {
    return params.includeDescriptions === false ? stripDescriptions(sdl) : sdl;
}

/** The first sentence of a description, for the one-line index entries. */
function summarise(description: string | null | undefined): string {
    if (!description) {
        return "";
    }
    const oneLine = description.replace(/\s+/g, " ").trim();
    const stop = oneLine.indexOf(". ");
    const first = stop === -1 ? oneLine : oneLine.slice(0, stop + 1);
    return first.length > 160 ? `${first.slice(0, 157)}...` : first;
}

/** `name(arg: Type!, ...): ReturnType` — the signature alone, no descriptions. */
function renderSignature(field: GraphQLField<unknown, unknown>): string {
    const args = field.args.map((arg: GraphQLArgument) => `${arg.name}: ${arg.type}`).join(", ");
    return `${field.name}${args ? `(${args})` : ""}: ${field.type}`;
}

/**
 * The root operations of the schema, as one line each.
 *
 * This is the default response. For the authoring schema it is 127 operations; for Edge it
 * is four, which is the whole point — an agent that reads this knows the entire surface and
 * can ask for the one type it needs next.
 */
function renderIndex(
    schema: GraphQLSchema,
    label: string,
    toolName: string,
    includeTypes: string[] = []
): string {
    const sections: string[] = [];
    const roots: Array<[string, ReturnType<GraphQLSchema["getQueryType"]>]> = [
        ["Queries", schema.getQueryType()],
        ["Mutations", schema.getMutationType()],
    ];

    let operationCount = 0;
    for (const [heading, root] of roots) {
        if (!root) {
            continue;
        }
        const fields = Object.values(root.getFields());
        operationCount += fields.length;
        const lines = fields
            .map((field) => {
                const summary = summarise(field.description);
                return `- ${renderSignature(field)}${summary ? `\n    ${summary}` : ""}`;
            })
            .join("\n");
        sections.push(`## ${heading} (${fields.length})\n\n${lines}`);
    }

    const typeCount = Object.values(schema.getTypeMap()).filter(
        (t) => !t.name.startsWith("__")
    ).length;

    // A schema whose whole surface is a handful of root fields (Edge) is not usefully
    // described by those fields alone -- what a caller needs next is the interface every
    // result implements, and the field accessor on it. Naming those types here puts the
    // real contract in the default response instead of costing a second call.
    for (const name of includeTypes) {
        const named = schema.getTypeMap()[name];
        if (named) {
            sections.push(`## ${named.name}\n\n${printType(named)}`);
        }
    }

    return [
        `# ${label}: ${operationCount} operations, ${typeCount} types`,
        "",
        `This is the operation index, not the full schema. Call ${toolName} again with `
        + `type: "<name>" for one operation or type in full (its argument types included), `
        + `search: "<keyword>" to find one by what it does, or full: true for the entire SDL.`,
        "",
        ...sections,
    ].join("\n");
}

/**
 * Every input, enum and custom scalar type reachable from a field's arguments.
 *
 * Without this, `type: "createUser"` would return a signature naming `CreateUserInput`
 * and the caller would need a second call — and often a third, because input objects nest.
 * The authoring schema has 108 input types precisely because its mutations take structured
 * arguments, so closing over them is what makes one call sufficient.
 */
function collectArgumentTypes(
    field: GraphQLField<unknown, unknown>
): GraphQLNamedType[] {
    const seen = new Set<string>();
    const collected: GraphQLNamedType[] = [];

    const visit = (named: GraphQLNamedType) => {
        if (seen.has(named.name) || named.name.startsWith("__")) {
            return;
        }
        seen.add(named.name);

        // Built-in scalars carry no information a caller does not already have.
        if (isScalarType(named) && ["String", "Int", "Float", "Boolean", "ID"].includes(named.name)) {
            return;
        }

        if (isInputObjectType(named)) {
            collected.push(named);
            for (const nested of Object.values(named.getFields())) {
                visit(getNamedType(nested.type));
            }
            return;
        }

        if (isEnumType(named) || isScalarType(named)) {
            collected.push(named);
        }
    };

    for (const arg of field.args) {
        visit(getNamedType(arg.type));
    }

    // The return type is printed as a name only; one level of it is usually what tells the
    // caller what they can select.
    const returned = getNamedType(field.type);
    if (!seen.has(returned.name) && !returned.name.startsWith("__")) {
        seen.add(returned.name);
        if (isObjectType(returned)) {
            collected.push(returned);
        }
    }

    return collected;
}

/** Names close enough to `wanted` to be worth suggesting after a miss. */
function suggestNames(schema: GraphQLSchema, wanted: string): string[] {
    const needle = wanted.toLowerCase();
    const candidates = new Set<string>();

    for (const type of Object.values(schema.getTypeMap())) {
        if (type.name.startsWith("__")) {
            continue;
        }
        if (type.name.toLowerCase().includes(needle)) {
            candidates.add(type.name);
        }
    }
    for (const root of [schema.getQueryType(), schema.getMutationType()]) {
        if (!root) {
            continue;
        }
        for (const field of Object.values(root.getFields())) {
            if (field.name.toLowerCase().includes(needle)) {
                candidates.add(`${root.name}.${field.name}`);
            }
        }
    }

    return [...candidates].slice(0, 25);
}

function renderType(
    schema: GraphQLSchema,
    wanted: string,
    params: SchemaSliceParams,
    toolName: string
): string {
    const named = schema.getTypeMap()[wanted];
    if (named && !named.name.startsWith("__")) {
        return applyDescriptions(printType(named), params);
    }

    // Not a type — try it as a root operation, which is how an agent will most often
    // arrive here after reading the index.
    for (const root of [schema.getQueryType(), schema.getMutationType()]) {
        if (!root) {
            continue;
        }
        const field = root.getFields()[wanted];
        if (!field) {
            continue;
        }

        const parts: string[] = [
            `# ${root.name}.${field.name}`,
            "",
            ...(field.description ? [field.description, ""] : []),
            "```graphql",
            renderSignature(field),
            "```",
        ];

        const referenced = collectArgumentTypes(field);
        if (referenced.length > 0) {
            parts.push("", `## Types referenced (${referenced.length})`, "");
            parts.push(referenced.map((t) => printType(t)).join("\n\n"));
        }

        return applyDescriptions(parts.join("\n"), params);
    }

    const suggestions = suggestNames(schema, wanted);
    return [
        `No type or root operation is named '${wanted}'.`,
        "",
        suggestions.length > 0
            ? `Closest matches: ${suggestions.join(", ")}.`
            : `Call ${toolName} with no arguments for the operation index, or `
            + `search: "<keyword>" to find one by what it does.`,
    ].join("\n");
}

function renderSearch(schema: GraphQLSchema, keyword: string, toolName: string): string {
    const needle = keyword.toLowerCase();
    const matches = (name: string, description?: string | null) =>
        name.toLowerCase().includes(needle)
        || (description ?? "").toLowerCase().includes(needle);

    const operations: string[] = [];
    for (const root of [schema.getQueryType(), schema.getMutationType()]) {
        if (!root) {
            continue;
        }
        for (const field of Object.values(root.getFields())) {
            if (matches(field.name, field.description)) {
                const summary = summarise(field.description);
                operations.push(
                    `- ${root.name}.${renderSignature(field)}${summary ? `\n    ${summary}` : ""}`
                );
            }
        }
    }

    const types: string[] = [];
    for (const type of Object.values(schema.getTypeMap())) {
        if (type.name.startsWith("__") || !matches(type.name, type.description)) {
            continue;
        }
        const summary = summarise(type.description);
        types.push(`- ${type.name}${summary ? ` — ${summary}` : ""}`);
    }

    if (operations.length === 0 && types.length === 0) {
        return `Nothing in the schema matches '${keyword}'. Call ${toolName} with no `
            + `arguments for the operation index.`;
    }

    const sections = [`# Schema matches for '${keyword}'`, ""];
    if (operations.length > 0) {
        sections.push(`## Operations (${operations.length})`, "", operations.join("\n"), "");
    }
    if (types.length > 0) {
        // Types are capped: a keyword like 'page' matches most of a template-generated
        // schema, and a 300-name list is the bloat this module exists to prevent.
        const shown = types.slice(0, 60);
        sections.push(
            `## Types (${types.length}${types.length > shown.length ? `, showing ${shown.length}` : ""})`,
            "",
            shown.join("\n"),
            ""
        );
    }
    sections.push(`Call ${toolName} with type: "<name>" for any of these in full.`);
    return sections.join("\n");
}

/**
 * Renders the requested slice of a schema. Precedence is `full`, then `type`, then
 * `search`, then the index — most specific request wins.
 */
export function sliceSchema(
    schema: GraphQLSchema,
    params: SchemaSliceParams,
    options: { label: string; toolName: string; indexIncludeTypes?: string[] }
): string {
    if (params.full) {
        return applyDescriptions(printSchema(schema), params);
    }
    if (params.type && params.type.trim() !== "") {
        return renderType(schema, params.type.trim(), params, options.toolName);
    }
    if (params.search && params.search.trim() !== "") {
        return renderSearch(schema, params.search.trim(), options.toolName);
    }
    return applyDescriptions(
        renderIndex(schema, options.label, options.toolName, options.indexIncludeTypes ?? []),
        params
    );
}
