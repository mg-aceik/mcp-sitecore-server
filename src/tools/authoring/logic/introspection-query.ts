/**
 * The introspection query for the Authoring and Management endpoint.
 *
 * graphql-js's own `getIntrospectionQuery()` cannot be used here. It nests `ofType` nine
 * levels deep to unwrap `[[String!]!]!`-style types, and this endpoint enforces a maximum
 * query depth of 13, which that exceeds — a live CM answers it with
 * *"The query exceded the maximum allowed execution depth of 13"* and no data at all.
 *
 * So this is the same query with the type-reference chain shortened to seven levels, which
 * fits inside the cap and was verified against a live endpoint (117KB of SDL). Seven levels
 * of wrapping is far more than any real schema uses: `[[String!]!]!` is four.
 *
 * `buildClientSchema` accepts this result exactly as it accepts the standard one — the
 * shape is identical, only the unwrapping depth differs.
 */

/** The nested `ofType` chain, `depth` levels deep. */
function typeRefChain(depth: number): string {
    let chain = "kind\n              name\n";
    for (let level = 0; level < depth; level += 1) {
        chain = `kind\n              name\n              ofType {\n                ${chain}              }\n`;
    }
    return chain;
}

/**
 * How deep to unwrap a type reference. Seven keeps the whole document within the
 * endpoint's depth cap while leaving far more room than any real type needs.
 */
export const TYPE_REF_DEPTH = 7;

export function authoringIntrospectionQuery(depth: number = TYPE_REF_DEPTH): string {
    return `query IntrospectionQuery {
  __schema {
    queryType { name }
    mutationType { name }
    subscriptionType { name }
    types { ...FullType }
    directives {
      name
      description
      locations
      args { ...InputValue }
    }
  }
}

fragment FullType on __Type {
  kind
  name
  description
  fields(includeDeprecated: true) {
    name
    description
    args { ...InputValue }
    type { ...TypeRef }
    isDeprecated
    deprecationReason
  }
  inputFields { ...InputValue }
  interfaces { ...TypeRef }
  enumValues(includeDeprecated: true) {
    name
    description
    isDeprecated
    deprecationReason
  }
  possibleTypes { ...TypeRef }
}

fragment InputValue on __InputValue {
  name
  description
  type { ...TypeRef }
  defaultValue
}

fragment TypeRef on __Type {
  ${typeRefChain(depth)}}`;
}
