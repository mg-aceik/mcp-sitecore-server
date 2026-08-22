import type { McpServer } from "@modelcontextprotocol/server";
import type { Config } from "@/config.js";
import { z } from "zod";
import { safeMcpResponse } from "@/helper.js";
import { requireOneTarget } from "@/tools/target-input.js";
import { runAuthoringOperation } from "../logic/run.js";
import { TEMPLATE_SELECTION } from "../logic/selections.js";

/**
 * Data template operations over the Authoring and Management API.
 *
 * The create/update pair is the reason this group exists: it builds a template, its
 * sections and its fields in one call, which over SPE takes a script per level and over
 * the Item Service is not expressible at all. `updateItemTemplate` is additive by default
 * — a section or field with an ID is updated, one without is created, and nothing is
 * removed unless `deleteMissingFields` says so.
 */

/** One field within a section. The names are the live schema's ItemTemplateFieldInput. */
const templateFieldSchema = z.object({
    name: z.string().describe("The field name, e.g. 'Title'."),
    type: z.string().optional()
        .describe("The Sitecore field type, e.g. 'Single-Line Text', 'Rich Text', 'Image', 'Droptree'. Required when creating a field."),
    templateFieldId: z.string().optional()
        .describe("The GUID of an existing field to update. Omit to create a new field."),
    source: z.string().optional()
        .describe("The field's data source, e.g. a datasource path or query for a Droplink."),
    title: z.string().optional().describe("The label shown to authors instead of the field name."),
    defaultValue: z.string().optional().describe("The value new items get for this field."),
    sortOrder: z.number().int().optional().describe("Position of the field within its section."),
    validation: z.string().optional().describe("A validation regular expression."),
    validationText: z.string().optional().describe("The message shown when validation fails."),
    description: z.string().optional().describe("Help text for the field."),
});

/** One section of a template. */
const templateSectionSchema = z.object({
    name: z.string().describe("The section name, e.g. 'Content'."),
    templateSectionId: z.string().optional()
        .describe("The GUID of an existing section to update. Omit to create a new section."),
    icon: z.string().optional().describe("The section's icon, e.g. 'Office/16x16/document.png'."),
    sortOrder: z.number().int().optional().describe("Position of the section within the template."),
    fields: z.array(templateFieldSchema).optional().describe("The fields in this section."),
});

export function authoringGetTemplateTool(server: McpServer, config: Config) {
    server.registerTool(
        "authoring-get-item-template",
        {
            description:
                "Reads a Sitecore data template over the Authoring and Management API, returning its "
                + "sections and field definitions (name, type, source). Call this before "
                + "authoring-create-item to learn which fields a template accepts, or before "
                + "authoring-update-item-template to get the section and field IDs an update needs. "
                + "Sections report their ID as itemTemplateSectionId; an update supplies that same "
                + "value as templateSectionId. Supply exactly one of templateId or path.",
            inputSchema: z.object({
                templateId: z.string().optional()
                    .describe("The template's GUID. Supply this or path."),
                path: z.string().optional()
                    .describe("The template's path RELATIVE to /sitecore/templates, with no leading slash — e.g. 'Project/MySite/Page' or 'Sample/Sample Item'. An absolute path is rejected by the endpoint. Supply this or templateId."),
                database: z.string().optional().describe("The database holding the template. Defaults to master."),
            }),
        },
        (params) => {
            const invalid = requireOneTarget(params, ["templateId", "path"]);
            if (invalid) {
                return Promise.resolve(invalid);
            }

            const query = `
                query GetItemTemplate($where: ItemTemplateQueryInput) {
                  itemTemplate(where: $where) {${TEMPLATE_SELECTION}
                    baseTemplates(directOnly: true) { nodes { templateId name fullName } }
                  }
                }`;

            return safeMcpResponse(runAuthoringOperation(config, query, {
                where: {
                    templateId: params.templateId,
                    path: params.path,
                    database: params.database,
                },
            }));
        }
    );
}

export function authoringCreateTemplateTool(server: McpServer, config: Config) {
    server.registerTool(
        "authoring-create-item-template",
        {
            description:
                "Creates a Sitecore data template, with its sections and fields, in one call over the "
                + "Authoring and Management API. The parent must be a GUID — the folder under "
                + "/sitecore/templates the template belongs in. Field types are Sitecore's own names, "
                + "e.g. 'Single-Line Text', 'Rich Text', 'Image', 'General Link', 'Droptree'.",
            inputSchema: z.object({
                name: z.string().describe("The template's name."),
                parent: z.string()
                    .describe("The GUID of the template folder to create in. A path is not accepted — resolve it with authoring-get-item."),
                sections: z.array(templateSectionSchema).optional()
                    .describe("The sections and their fields. A template with no sections holds no fields of its own."),
                baseTemplates: z.array(z.string()).optional()
                    .describe("GUIDs of templates to inherit from. Page templates normally inherit the site's base page template."),
                icon: z.string().optional().describe("The template's icon, e.g. 'Office/16x16/document.png'."),
                createStandardValuesItem: z.boolean().optional()
                    .describe("When true, create the __Standard Values item, which is where presentation details and field defaults live."),
                language: z.string().optional().describe("The language to create the template in."),
                database: z.string().optional().describe("The database to create in. Defaults to master."),
            }),
        },
        (params) => {
            const query = `
                mutation CreateItemTemplate($input: CreateItemTemplateInput!) {
                  createItemTemplate(input: $input) {
                    itemTemplate {${TEMPLATE_SELECTION}
                    }
                  }
                }`;

            return safeMcpResponse(runAuthoringOperation(config, query, {
                input: {
                    name: params.name,
                    parent: params.parent,
                    sections: params.sections,
                    baseTemplates: params.baseTemplates,
                    icon: params.icon,
                    createStandardValuesItem: params.createStandardValuesItem,
                    language: params.language,
                    database: params.database,
                },
            }));
        }
    );
}

export function authoringUpdateTemplateTool(server: McpServer, config: Config) {
    server.registerTool(
        "authoring-update-item-template",
        {
            description:
                "Updates a Sitecore data template over the Authoring and Management API. Sections and "
                + "fields carrying an ID are updated; those without one are created. Matching is by ID "
                + "only, never by name: to add a field to a section that already exists you must pass "
                + "that section's templateSectionId (read it as itemTemplateSectionId from "
                + "authoring-get-item-template), otherwise the call is rejected for creating a second "
                + "section of the same name. Nothing is removed unless deleteMissingFields is true — "
                + "and when it is, every section and field absent from this call is deleted, along "
                + "with the content stored in them, so read the template first.",
            inputSchema: z.object({
                templateId: z.string().describe("The GUID of the template to update."),
                name: z.string().optional().describe("A new name for the template. Omit to leave it unchanged."),
                sections: z.array(templateSectionSchema).optional()
                    .describe("Sections to update or add. Include templateSectionId / templateFieldId to update rather than create."),
                baseTemplates: z.array(z.string()).optional()
                    .describe("GUIDs of templates to inherit from. This replaces the current list rather than adding to it."),
                icon: z.string().optional().describe("A new icon for the template."),
                deleteMissingFields: z.boolean().optional()
                    .describe("When true, delete every section and field not named in this call, discarding their content. Off by default."),
                createStandardValuesItem: z.boolean().optional()
                    .describe("When true, create the __Standard Values item if the template does not have one."),
                language: z.string().optional().describe("The language to write template text in."),
                database: z.string().optional().describe("The database holding the template. Defaults to master."),
            }),
        },
        (params) => {
            const query = `
                mutation UpdateItemTemplate($input: UpdateItemTemplateInput!) {
                  updateItemTemplate(input: $input) {
                    itemTemplate {${TEMPLATE_SELECTION}
                    }
                  }
                }`;

            return safeMcpResponse(runAuthoringOperation(config, query, {
                input: {
                    templateId: params.templateId,
                    name: params.name,
                    sections: params.sections,
                    baseTemplates: params.baseTemplates,
                    icon: params.icon,
                    deleteMissingFields: params.deleteMissingFields,
                    createStandardValuesItem: params.createStandardValuesItem,
                    language: params.language,
                    database: params.database,
                },
            }));
        }
    );
}
