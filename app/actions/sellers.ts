"use server"

import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { isElasticsearchConfigured } from "@/lib/elasticsearch/config"
import { searchSellerIdsFromElasticsearch } from "@/lib/elasticsearch/sellers-index"

/** Shape returned to the `/sellers` directory dropdown. */
export type SellerSuggestRow = {
  id: string
  seller_slug: string
  display_name: string | null
  shop_name: string | null
  shop_logo_url: string | null
  avatar_url: string | null
  city: string | null
  shop_address: string | null
  is_shop: boolean
  shop_verified: boolean
}

const MAX_SELLER_SUGGEST = 12

const SELLER_PUBLIC_FIELDS =
  "id, seller_slug, display_name, shop_name, shop_logo_url, avatar_url, city, shop_address, is_shop, shop_verified" as const

/**
 * Public directory reads — use the service role when configured so anonymous visitors
 * still see sellers. Matches the pattern used in `app/sellers/page.tsx`.
 */
async function getSupabaseForPublicSellersDirectory() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return createServiceRoleClient()
  }
  return await createClient()
}

function escapeIlikeToken(q: string) {
  return q.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

function normalizeRow(row: Record<string, unknown>): SellerSuggestRow {
  return {
    id: row.id as string,
    seller_slug: (row.seller_slug as string | null) ?? "",
    display_name: (row.display_name as string | null) ?? null,
    shop_name: (row.shop_name as string | null) ?? null,
    shop_logo_url: (row.shop_logo_url as string | null) ?? null,
    avatar_url: (row.avatar_url as string | null) ?? null,
    city: (row.city as string | null) ?? null,
    shop_address: (row.shop_address as string | null) ?? null,
    is_shop: Boolean(row.is_shop),
    shop_verified: Boolean(row.shop_verified),
  }
}

/**
 * Search the seller directory — shops and individual sellers who have at least one
 * active, visible listing. Returns profile rows only (never listings / brands / categories).
 *
 * Uses Elasticsearch when configured; otherwise falls back to Supabase `ilike` with the
 * same eligibility filter used by `/sellers` server page rendering.
 */
export async function searchSellersCatalogSuggest(
  qRaw: string,
): Promise<SellerSuggestRow[]> {
  const q = (qRaw || "").trim().replace(/%/g, "")
  if (q.length < 1) return []

  const supabase = await getSupabaseForPublicSellersDirectory()

  if (isElasticsearchConfigured()) {
    try {
      const ids = await searchSellerIdsFromElasticsearch(q, MAX_SELLER_SUGGEST)
      if (ids.length > 0) {
        const { data, error } = await supabase
          .from("profiles")
          .select(SELLER_PUBLIC_FIELDS)
          .in("id", ids)

        if (!error && data?.length) {
          const byId = new Map<string, SellerSuggestRow>()
          for (const row of data as Record<string, unknown>[]) {
            byId.set(row.id as string, normalizeRow(row))
          }
          return ids
            .map((id) => byId.get(id))
            .filter((row): row is SellerSuggestRow => row != null)
            .filter((row) => row.seller_slug.length > 0)
        }
      }
    } catch (err) {
      console.error(
        "[searchSellersCatalogSuggest] Elasticsearch error, falling back to Supabase:",
        err,
      )
    }
  }

  const safe = escapeIlikeToken(q)
  const pattern = `"%${safe}%"`

  const [{ data: shopRows }, { data: listingSellerRows }] = await Promise.all([
    supabase.from("profiles").select("id").eq("is_shop", true),
    supabase
      .from("listings")
      .select("user_id")
      .eq("status", "active")
      .eq("hidden_from_site", false)
      .is("archived_at", null),
  ])

  const eligibleIds = new Set<string>()
  for (const row of shopRows ?? []) eligibleIds.add(row.id as string)
  for (const row of listingSellerRows ?? [])
    eligibleIds.add(row.user_id as string)

  if (eligibleIds.size === 0) return []

  const { data, error } = await supabase
    .from("profiles")
    .select(SELLER_PUBLIC_FIELDS)
    .in("id", [...eligibleIds])
    .or(
      `shop_name.ilike.${pattern},display_name.ilike.${pattern},seller_slug.ilike.${pattern},city.ilike.${pattern},shop_address.ilike.${pattern}`,
    )
    .order("shop_verified", { ascending: false })
    .order("is_shop", { ascending: false })
    .order("sales_count", { ascending: false })
    .limit(MAX_SELLER_SUGGEST)

  if (error || !data) {
    if (error && process.env.NODE_ENV === "development") {
      console.error("[searchSellersCatalogSuggest]", error)
    }
    return []
  }

  return (data as Record<string, unknown>[])
    .map(normalizeRow)
    .filter((row) => row.seller_slug.length > 0)
}
