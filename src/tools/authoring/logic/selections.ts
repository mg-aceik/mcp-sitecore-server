/**
 * The selection sets the typed authoring tools request.
 *
 * They live here rather than inline so that every tool returning an item returns the
 * *same* shape — an agent that has read one `authoring-*` result can predict the next —
 * and so widening what a tool returns is a one-line change rather than a sweep.
 *
 * Depth matters: the endpoint rejects any document deeper than 13 levels (verified on a
 * live CM, and it is why the introspection tool ships its own shallower query). A
 * selection set nested much further than these will be refused before it runs.
 */

/**
 * An item, with its own content fields.
 *
 * `ownFields: true` and `excludeStandardFields: true` drop the ~80 standard fields every
 * Sitecore item carries, which would otherwise bury the handful the caller cares about.
 * The tools that read fields expose both as parameters.
 */
export const ITEM_SELECTION = `
    itemId
    name
    displayName
    path
    database
    language { name }
    version
    hasChildren
    template { templateId name fullName }
    fields(ownFields: $ownFields, excludeStandardFields: $excludeStandardFields) {
      nodes { name value }
    }`;

/** The item shape returned by a mutation, where the caller wants identity, not content. */
export const MUTATED_ITEM_SELECTION = `
    itemId
    name
    path
    database
    language { name }
    version
    template { templateId name }`;

/**
 * A template with its sections and its fields.
 *
 * The nesting runs the opposite way to the input types: `ItemTemplateSection` carries no
 * fields (verified against a live endpoint, which rejects `sections { fields }`), so the
 * grouping is read off each field's own `section`. Note also that a section's ID reads as
 * `itemTemplateSectionId` here but is supplied to an update as `templateSectionId`.
 */
export const TEMPLATE_SELECTION = `
    templateId
    name
    fullName
    icon
    sections {
      nodes { itemTemplateSectionId name sortOrder icon }
    }
    ownFields {
      nodes {
        templateFieldId
        name
        type
        source
        sortOrder
        defaultValue
        validation
        section { itemTemplateSectionId name }
      }
    }`;

/** A job and its progress. Shared by the job queries and the index rebuild. */
export const JOB_SELECTION = `
    name
    displayName
    handle
    done
    queueTime
    status { jobState processed total messages exceptions }`;
