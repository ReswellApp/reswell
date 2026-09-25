import type { SupabaseClient } from "@supabase/supabase-js"
import type { KlaviyoListingProductSource } from "@/lib/klaviyo/catalog-product"
import { PEER_LISTING_SECTIONS_FILTER } from "@/lib/peer-listing-sections"

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

const CATALOG_SYNC_LISTING_SELECT = `
  ${CATALOG_LISTING_SELECT},
  status,
  hidden_from_site,
  archived_at
`.trim()

export type KlaviyoCatalogSyncListing = KlaviyoListingProductSource & {
  status: string | null
  hidden_from_site: boolean | null
  archived_at: string | null
}

export type KlaviyoCatalogFeedPageResult = {
  rows: KlaviyoListingProductSource[]
  nextOffset: number | null
}

/**
 * Active, site-visible peer listings for Klaviyo custom catalog sync (newest first).
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
    .is("archived_at", null)
    .in("section", PEER_LISTING_SECTIONS_FILTER)
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

export async function fetchKlaviyoCatalogListingById(
  supabase: SupabaseClient,
  listingId: string,
): Promise<KlaviyoCatalogSyncListing | null> {
  const { data, error } = await supabase
    .from("listings")
    .select(CATALOG_SYNC_LISTING_SELECT)
    .eq("id", listingId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null
  return data as unknown as KlaviyoCatalogSyncListing
}

export async function fetchKlaviyoCatalogListingsByIds(
  supabase: SupabaseClient,
  ids: readonly string[],
): Promise<KlaviyoCatalogSyncListing[]> {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))]
  if (unique.length === 0) return []

  const rows: KlaviyoCatalogSyncListing[] = []
  const chunkSize = 80
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize)
    const { data, error } = await supabase
      .from("listings")
      .select(CATALOG_SYNC_LISTING_SELECT)
      .in("id", chunk)

    if (error) throw new Error(error.message)
    if (Array.isArray(data)) {
      rows.push(...(data as unknown as KlaviyoCatalogSyncListing[]))
    }
  }
  return rows
}

/** Live listings touched recently, so a missed publish hook still reaches Klaviyo. */
export async function fetchRecentlyUpdatedLiveKlaviyoCatalogListings(
  supabase: SupabaseClient,
  updatedAfterIso: string,
  limit: number,
): Promise<KlaviyoCatalogSyncListing[]> {
  const { data, error } = await supabase
    .from("listings")
    .select(CATALOG_SYNC_LISTING_SELECT)
    .eq("status", "active")
    .eq("hidden_from_site", false)
    .is("archived_at", null)
    .in("section", PEER_LISTING_SECTIONS_FILTER)
    .gte("updated_at", updatedAfterIso)
    .order("updated_at", { ascending: false })
    .limit(Math.max(1, limit))

  if (error) throw new Error(error.message)
  return Array.isArray(data) ? (data as unknown as KlaviyoCatalogSyncListing[]) : []
}
