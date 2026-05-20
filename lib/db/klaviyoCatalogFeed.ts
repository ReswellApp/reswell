import type { SupabaseClient } from "@supabase/supabase-js"
import type { KlaviyoListingProductSource } from "@/lib/klaviyo/catalog-product"

export const KLAVIYO_CATALOG_FEED_PAGE_SIZE = 500

const CATALOG_LISTING_SELECT = `
  id,
  slug,
  title,
  description,
  price,
  section,
  city,
  state,
  board_type,
  brand,
  condition,
  listing_images ( url, thumbnail_url, is_primary, sort_order )
`.trim()

export type KlaviyoCatalogFeedPageResult = {
  rows: KlaviyoListingProductSource[]
  nextOffset: number | null
}

/**
 * Active, site-visible surfboard listings for Klaviyo custom catalog sync (newest first).
 */
export async function fetchKlaviyoCatalogFeedPage(
  supabase: SupabaseClient,
  offset: number,
  limit: number = KLAVIYO_CATALOG_FEED_PAGE_SIZE,
): Promise<KlaviyoCatalogFeedPageResult> {
  const from = Math.max(0, offset)
  const to = from + Math.max(1, limit) - 1

  const { data, error } = await supabase
    .from("listings")
    .select(CATALOG_LISTING_SELECT)
    .eq("status", "active")
    .eq("hidden_from_site", false)
    .eq("section", "surfboards")
    .order("created_at", { ascending: false })
    .range(from, to)

  if (error) {
    throw new Error(error.message)
  }

  const rows = Array.isArray(data)
    ? (data as unknown as KlaviyoListingProductSource[])
    : []
  const nextOffset = rows.length < limit ? null : from + rows.length

  return { rows, nextOffset }
}
