import type { SupabaseClient } from "@supabase/supabase-js"
import { getElasticsearchClient } from "./client"
import { ELASTICSEARCH_BRANDS_INDEX } from "./config"

export type BrandSearchDoc = {
  id: string
  name: string
  slug: string
  short_description: string
  lead_shaper_name: string
  location_label: string
  founder_name: string
}

const INDEX_SETTINGS = {
  analysis: {
    normalizer: {
      lowercase: {
        type: "custom" as const,
        filter: ["lowercase", "asciifolding"],
      },
    },
    analyzer: {
      brand_text: {
        type: "custom" as const,
        tokenizer: "standard",
        filter: ["lowercase", "asciifolding"],
      },
    },
  },
}

const INDEX_MAPPINGS = {
  properties: {
    id: { type: "keyword" as const },
    name: {
      type: "text" as const,
      analyzer: "brand_text",
      fields: {
        keyword: { type: "keyword" as const, normalizer: "lowercase" },
      },
    },
    slug: {
      type: "text" as const,
      analyzer: "brand_text",
      fields: { keyword: { type: "keyword" as const, normalizer: "lowercase" } },
    },
    short_description: { type: "text" as const, analyzer: "brand_text" },
    lead_shaper_name: { type: "text" as const, analyzer: "brand_text" },
    location_label: { type: "text" as const, analyzer: "brand_text" },
    founder_name: { type: "text" as const, analyzer: "brand_text" },
  },
}

export async function ensureBrandsIndex(): Promise<void> {
  const es = getElasticsearchClient()
  if (!es) return

  try {
    const exists = await es.indices.exists({ index: ELASTICSEARCH_BRANDS_INDEX })
    if (!exists) {
      await es.indices.create({
        index: ELASTICSEARCH_BRANDS_INDEX,
        settings: INDEX_SETTINGS,
        mappings: INDEX_MAPPINGS,
      })
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[elasticsearch] ensureBrandsIndex failed:", msg, e)
  }
}

export async function indexBrandDocument(doc: BrandSearchDoc): Promise<void> {
  const es = getElasticsearchClient()
  if (!es) return

  const filled: BrandSearchDoc = {
    id: doc.id,
    name: doc.name ?? "",
    slug: doc.slug ?? "",
    short_description: doc.short_description ?? "",
    lead_shaper_name: doc.lead_shaper_name ?? "",
    location_label: doc.location_label ?? "",
    founder_name: doc.founder_name ?? "",
  }

  await ensureBrandsIndex()
  await es.index({
    index: ELASTICSEARCH_BRANDS_INDEX,
    id: doc.id,
    document: filled,
    refresh: false,
  })
}

export async function deleteBrandDocument(brandId: string): Promise<void> {
  const es = getElasticsearchClient()
  if (!es) return

  try {
    await es.delete({
      index: ELASTICSEARCH_BRANDS_INDEX,
      id: brandId,
      refresh: false,
    })
  } catch (e: unknown) {
    const status = (e as { meta?: { statusCode?: number } })?.meta?.statusCode
    if (status === 404) return
    throw e
  }
}

/** Escape `*` / `?` / `\` for Elasticsearch wildcard queries. */
function escapeElasticsearchWildcard(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/[*?]/g, "\\$&")
}

export function brandRowToSearchDoc(row: {
  id: string
  name: string
  slug: string
  short_description: string | null
  lead_shaper_name: string | null
  location_label: string | null
  founder_name: string | null
}): BrandSearchDoc {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    short_description: row.short_description ?? "",
    lead_shaper_name: row.lead_shaper_name ?? "",
    location_label: row.location_label ?? "",
    founder_name: row.founder_name ?? "",
  }
}

/**
 * Relevance-ordered brand ids for the directory typeahead.
 *
 * Short queries (<4 chars) use prefix matching only so "ch" matches "Channel", not
 * "Doug Schroedel" (substring inside "Schroedel"). Longer queries allow substring + fuzziness.
 */
export async function searchBrandIdsFromElasticsearch(
  rawQuery: string,
  limit: number,
): Promise<string[]> {
  const es = getElasticsearchClient()
  if (!es) return []

  const q = rawQuery.trim()
  if (!q) return []

  try {
    await ensureBrandsIndex()
    const w = escapeElasticsearchWildcard(q.toLowerCase())
    const usePrefixOnly = q.length < 4

    const should: object[] = [
      {
        wildcard: {
          "name.keyword": {
            value: usePrefixOnly ? `${w}*` : `*${w}*`,
            case_insensitive: true,
          },
        },
      },
      {
        wildcard: {
          "slug.keyword": {
            value: usePrefixOnly ? `${w}*` : `*${w}*`,
            case_insensitive: true,
          },
        },
      },
    ]

    if (!usePrefixOnly) {
      should.push({
        multi_match: {
          query: q,
          fields: ["name^3", "slug^2", "lead_shaper_name"],
          type: "bool_prefix",
          operator: "or",
        },
      })
    }

    if (q.length >= 4) {
      should.push({
        multi_match: {
          query: q,
          fields: ["name^4", "slug^3"],
          type: "best_fields",
          tie_breaker: 0.15,
          operator: "or",
          fuzziness: "AUTO",
        },
      })
    }

    const res = await es.search({
      index: ELASTICSEARCH_BRANDS_INDEX,
      size: limit,
      _source: false,
      query: {
        bool: {
          should,
          minimum_should_match: 1,
        },
      },
      sort: [
        { _score: { order: "desc" } },
        { "name.keyword": { order: "asc" } },
      ],
    })

    return (res.hits.hits ?? [])
      .map((h) => h._id)
      .filter((id): id is string => typeof id === "string" && id.length > 0)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[elasticsearch] searchBrandIdsFromElasticsearch failed:", msg, e)
    return []
  }
}

export async function syncBrandToIndex(
  supabase: SupabaseClient,
  brandId: string,
): Promise<void> {
  if (!getElasticsearchClient()) return

  const { data, error } = await supabase
    .from("brands")
    .select("id, name, slug, short_description, lead_shaper_name, location_label, founder_name")
    .eq("id", brandId)
    .maybeSingle()

  if (error || !data) {
    if (!error) await deleteBrandDocument(brandId)
    return
  }

  await indexBrandDocument(brandRowToSearchDoc(data as Parameters<typeof brandRowToSearchDoc>[0]))
}
