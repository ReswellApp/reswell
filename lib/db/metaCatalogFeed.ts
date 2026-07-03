import type { SupabaseClient } from "@supabase/supabase-js"
import {
  META_CATALOG_PEER_SECTIONS,
  type MetaListingProductSource,
} from "@/lib/meta/catalog-product"

export const META_CATALOG_FEED_PAGE_SIZE = 500

const CATALOG_LISTING_SELECT = `
  id,
  slug,
  title,
  description,
  price,
  section,
  status,
  hidden_from_site,
  brand,
  condition,
  listing_images ( url, thumbnail_url, is_primary, sort_order )
`.trim()

export type MetaCatalogFeedPageResult = {
  rows: MetaListingProductSource[]
  nextOffset: number | null
}

/**
 * Active, site-visible peer listings (surfboards + fins) for Meta Commerce catalog sync (newest first).
 */
export async function fetchMetaCatalogFeedPage(
  supabase: SupabaseClient,
  offset: number,
  limit: number = META_CATALOG_FEED_PAGE_SIZE,
): Promise<MetaCatalogFeedPageResult> {
  const from = Math.max(0, offset)
  const to = from + Math.max(1, limit) - 1

  const { data, error } = await supabase
    .from("listings")
    .select(CATALOG_LISTING_SELECT)
    .eq("status", "active")
    .eq("hidden_from_site", false)
    .in("section", [...META_CATALOG_PEER_SECTIONS])
    .order("created_at", { ascending: false })
    .range(from, to)

  if (error) {
    throw new Error(error.message)
  }

  const rows = Array.isArray(data)
    ? (data as unknown as MetaListingProductSource[])
    : []
  const nextOffset = rows.length < limit ? null : from + rows.length

  return { rows, nextOffset }
}
