import type { SupabaseClient } from "@supabase/supabase-js"
import { LISTING_SELLER_PROFILES_EMBED } from "@/lib/db/listing-seller-profile-embed"
import { OPENAI_CATALOG_SECTIONS_FILTER } from "@/lib/openai-commerce/config"
import type { OpenAiCatalogListingRow } from "@/lib/openai-commerce/catalog-product"

export const OPENAI_CATALOG_FEED_PAGE_SIZE = 500

const CATALOG_LISTING_SELECT = `
  id,
  user_id,
  slug,
  title,
  description,
  price,
  compare_at_price,
  stock_quantity,
  section,
  status,
  hidden_from_site,
  archived_at,
  brand,
  model,
  condition,
  board_type,
  dimensions,
  fins_setup,
  fin_system,
  fin_size,
  wetsuit_size,
  apparel_kind,
  apparel_size,
  magazine_year,
  city,
  state,
  local_pickup,
  shipping_available,
  shipping_price,
  board_shipping_cost_mode,
  shipping_packed_length_in,
  shipping_packed_width_in,
  shipping_packed_height_in,
  shipping_packed_weight_oz,
  listing_images ( url, thumbnail_url, is_primary, sort_order ),
  listing_videos ( url, thumbnail_url, sort_order, duration_seconds ),
  ${LISTING_SELLER_PROFILES_EMBED} ( seller_slug, display_name, shop_name, is_shop )
`.trim()

export type OpenAiCatalogFeedPageResult = {
  rows: OpenAiCatalogListingRow[]
  nextOffset: number | null
}

/**
 * Active, site-visible peer listings and Reswell shop inventory for the ChatGPT product feed.
 */
export async function fetchOpenAiCatalogFeedPage(
  supabase: SupabaseClient,
  offset: number,
  limit: number = OPENAI_CATALOG_FEED_PAGE_SIZE,
): Promise<OpenAiCatalogFeedPageResult> {
  const from = Math.max(0, offset)
  const to = from + Math.max(1, limit) - 1

  const { data, error } = await supabase
    .from("listings")
    .select(CATALOG_LISTING_SELECT)
    .eq("status", "active")
    .eq("hidden_from_site", false)
    .is("archived_at", null)
    .in("section", OPENAI_CATALOG_SECTIONS_FILTER)
    .order("created_at", { ascending: false })
    .range(from, to)

  if (error) {
    throw new Error(error.message)
  }

  const rows = Array.isArray(data) ? (data as unknown as OpenAiCatalogListingRow[]) : []
  const nextOffset = rows.length < limit ? null : from + rows.length

  return { rows, nextOffset }
}
