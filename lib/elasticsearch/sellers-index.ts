import type { SupabaseClient } from "@supabase/supabase-js"
import { PEER_LISTING_SECTIONS_FILTER } from "@/lib/peer-listing-sections"
import { getElasticsearchClient } from "./client"

/**
 * Sellers (shop + seller profile) search index for the `/sellers` directory dropdown.
 * A document represents a `profiles` row that qualifies as a seller — either:
 *   - `is_shop = true`, or
 *   - Has at least one active, visible peer marketplace listing.
 *
 * Reswell retail (`section = new`) does not qualify a profile as a marketplace seller.
 * Profiles that stop qualifying are removed from the index.
 */
export const ELASTICSEARCH_SELLERS_INDEX =
  process.env.ELASTICSEARCH_SELLERS_INDEX || "reswell_sellers"

export type SellerSearchDoc = {
  id: string
  seller_slug: string
  display_name: string
  shop_name: string
  shop_description: string
  bio: string
  city: string
  shop_address: string
  is_shop: boolean
  shop_verified: boolean
  has_active_listings: boolean
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
      seller_text: {
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
    seller_slug: {
      type: "text" as const,
      analyzer: "seller_text",
      fields: { keyword: { type: "keyword" as const, normalizer: "lowercase" } },
    },
    display_name: {
      type: "text" as const,
      analyzer: "seller_text",
      fields: { keyword: { type: "keyword" as const, normalizer: "lowercase" } },
    },
    shop_name: {
      type: "text" as const,
      analyzer: "seller_text",
      fields: { keyword: { type: "keyword" as const, normalizer: "lowercase" } },
    },
    shop_description: { type: "text" as const, analyzer: "seller_text" },
    bio: { type: "text" as const, analyzer: "seller_text" },
    city: { type: "text" as const, analyzer: "seller_text" },
    shop_address: { type: "text" as const, analyzer: "seller_text" },
    is_shop: { type: "boolean" as const },
    shop_verified: { type: "boolean" as const },
    has_active_listings: { type: "boolean" as const },
  },
}

export async function ensureSellersIndex(): Promise<void> {
  const es = getElasticsearchClient()
  if (!es) return

  try {
    const exists = await es.indices.exists({ index: ELASTICSEARCH_SELLERS_INDEX })
    if (!exists) {
      await es.indices.create({
        index: ELASTICSEARCH_SELLERS_INDEX,
        settings: INDEX_SETTINGS,
        mappings: INDEX_MAPPINGS,
      })
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[elasticsearch] ensureSellersIndex failed:", msg, e)
  }
}

export async function indexSellerDocument(doc: SellerSearchDoc): Promise<void> {
  const es = getElasticsearchClient()
  if (!es) return

  await ensureSellersIndex()
  await es.index({
    index: ELASTICSEARCH_SELLERS_INDEX,
    id: doc.id,
    document: doc,
    refresh: false,
  })
}

export async function deleteSellerDocument(profileId: string): Promise<void> {
  const es = getElasticsearchClient()
  if (!es) return

  try {
    await es.delete({
      index: ELASTICSEARCH_SELLERS_INDEX,
      id: profileId,
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

export type SellerProfileRow = {
  id: string
  seller_slug: string | null
  display_name: string | null
  shop_name: string | null
  shop_description: string | null
  bio: string | null
  city: string | null
  shop_address: string | null
  is_shop: boolean | null
  shop_verified: boolean | null
}

export function profileRowToSellerDoc(
  row: SellerProfileRow,
  hasActiveListings: boolean,
): SellerSearchDoc {
  return {
    id: row.id,
    seller_slug: row.seller_slug ?? "",
    display_name: row.display_name ?? "",
    shop_name: row.shop_name ?? "",
    shop_description: row.shop_description ?? "",
    bio: row.bio ?? "",
    city: row.city ?? "",
    shop_address: row.shop_address ?? "",
    is_shop: Boolean(row.is_shop),
    shop_verified: Boolean(row.shop_verified),
    has_active_listings: hasActiveListings,
  }
}

const SELLER_PROFILE_FIELDS =
  "id, seller_slug, display_name, shop_name, shop_description, bio, city, shop_address, is_shop, shop_verified" as const

/** A profile is a seller if they are a shop OR currently have any active, visible listing. */
export async function userHasActiveListings(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { count, error } = await supabase
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "active")
    .eq("hidden_from_site", false)
    .is("archived_at", null)
    .in("section", PEER_LISTING_SECTIONS_FILTER)
    .limit(1)
  if (error) return false
  return (count ?? 0) > 0
}

/**
 * Upsert or remove a profile from the sellers index based on current eligibility.
 * Safe no-op when Elasticsearch is not configured.
 */
export async function syncProfileToSellerIndex(
  supabase: SupabaseClient,
  profileId: string,
): Promise<void> {
  if (!getElasticsearchClient()) return

  const { data, error } = await supabase
    .from("profiles")
    .select(SELLER_PROFILE_FIELDS)
    .eq("id", profileId)
    .maybeSingle()

  if (error || !data) {
    await deleteSellerDocument(profileId)
    return
  }

  const row = data as SellerProfileRow
  const hasListings = await userHasActiveListings(supabase, profileId)
  const eligible = Boolean(row.is_shop) || hasListings

  if (!eligible || !row.seller_slug) {
    await deleteSellerDocument(profileId)
    return
  }

  await indexSellerDocument(profileRowToSellerDoc(row, hasListings))
}

const SEARCH_FIELDS = [
  "shop_name^4",
  "display_name^3",
  "seller_slug^2",
  "city^1.5",
  "shop_address",
  "shop_description",
  "bio",
] as const

/**
 * Relevance-ordered seller profile ids for the directory typeahead.
 * Analyzed matches (fuzzy + phrase) plus case-insensitive wildcard on shop/display keywords
 * so short prefixes (e.g. "pa") behave like the previous `ilike '%…%'` query.
 */
export async function searchSellerIdsFromElasticsearch(
  rawQuery: string,
  limit: number,
): Promise<string[]> {
  const es = getElasticsearchClient()
  if (!es) return []

  const q = rawQuery.trim()
  if (!q) return []

  try {
    await ensureSellersIndex()
    const w = escapeElasticsearchWildcard(q.toLowerCase())

    const should: object[] = [
      {
        multi_match: {
          query: q,
          fields: [...SEARCH_FIELDS],
          type: "best_fields",
          tie_breaker: 0.2,
          operator: "or",
          fuzziness: "AUTO",
        },
      },
      {
        wildcard: {
          "shop_name.keyword": { value: `*${w}*`, case_insensitive: true },
        },
      },
      {
        wildcard: {
          "display_name.keyword": { value: `*${w}*`, case_insensitive: true },
        },
      },
      {
        wildcard: {
          "seller_slug.keyword": { value: `*${w}*`, case_insensitive: true },
        },
      },
    ]

    const res = await es.search({
      index: ELASTICSEARCH_SELLERS_INDEX,
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
        { shop_verified: { order: "desc" } },
        { is_shop: { order: "desc" } },
      ],
    })

    return (res.hits.hits ?? [])
      .map((h) => h._id)
      .filter((id): id is string => typeof id === "string" && id.length > 0)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[elasticsearch] searchSellerIdsFromElasticsearch failed:", msg, e)
    return []
  }
}
