import type { CallToolResult } from "@modelcontextprotocol/server";
import { type Config } from "@/config.js";
import RestfulItemServiceClient from "../../client.js";

/**
 * The Item Service returns a facet breakdown alongside every search, whether or not the
 * caller asked for one, and it dominates the response: measured against a live CM with
 * `pageSize: 5`, the whole result was 62,277 characters of which `Facets` was 46,014 —
 * 96% of the meaningful payload, against 1,720 characters of actual `Results`. The
 * `_templatename` facet alone contributed 100 values and 30,949 characters, and each value
 * carries a `Link` object holding a fully-qualified callback URL that repeats the CM
 * hostname.
 *
 * So facets are opt-in here, and even when asked for, the per-value `Link` is dropped: the
 * facet's name and count are the information, and the URL is reconstructible from the
 * request that produced it.
 */
type FacetValue = { Name?: string; AggregateCount?: number; Link?: unknown };
type Facet = { Name?: string; Values?: FacetValue[] };

function trimFacets(facets: Facet[]): Facet[] {
    return facets.map((facet) => ({
        ...facet,
        Values: (facet.Values ?? []).map(({ Link, ...rest }) => rest),
    }));
}

export async function searchItems(
  conf: Config,
  options: {
    term: string;
    fields?: string[];
    facet?: string;
    page?: number;
    pageSize?: number;
    database?: string;
    includeStandardTemplateFields?: boolean;
    includeFacets?: boolean;
  }
): Promise<CallToolResult> {
  const client = new RestfulItemServiceClient(
    conf.itemService.serverUrl,
    conf.itemService.username,
    conf.itemService.password,
    conf.itemService.domain
  );
  const response = await client.searchItems(options);

  let shaped: unknown = response;
  if (response && typeof response === "object" && "Facets" in (response as object)) {
    const { Facets, ...rest } = response as Record<string, unknown>;
    shaped = options.includeFacets
      ? { ...rest, Facets: trimFacets((Facets as Facet[]) ?? []) }
      : rest;
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(shaped, null, 2),
      },
    ],
    isError: false,
  };
}
