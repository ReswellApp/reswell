/**
 * Data access for boardbag listings. Boardbags are `listings` rows
 * (section = 'boardbags') with the boardbag attributes stored directly on the row:
 * `boardbag_size` (size), plus `brand`/`brand_id`/`model`.
 *
 * Mirrors the fin browse data layer (`lib/db/fin-listings.ts`) scoped to boardbags.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { BOARDBAGS_SECTION } from "@/lib/boardbag-listing-config"
import type { BoardbagsBrowseFacetSelections } from "@/lib/boardbags-browse-facets"
import { normalizedBoardbagsBrowseSort } from "@/lib/boardbags-browse-metadata"
import { listingDetailHref } from "@/lib/listing-href"

export const BOARDBAGS_BROWSE_PAGE_SIZE = 40

export type BoardbagListingImage = {
  id: string
  url: string
  thumbnail_url: string | null
  is_primary: boolean | null
  sort_order: number | null
}

export type BoardbagBrowseListingRow = {
  id: string
  slug: string | null
  user_id: string
  title: string
  price: number
  compare_at_price: number | null
  status: string
  condition: string | null
  local_pickup: boolean | null
  shipping_available: boolean | null
  created_at: string
  boardbag_size: string | null
  brand: string | null
  brand_id: string | null
  model: string | null
  listing_images: BoardbagListingImage[] | null
}

const BOARDBAG_BROWSE_LISTING_SELECT = `
  id,
  slug,
  user_id,
  title,
  price,
  compare_at_price,
  status,
  condition,
  local_pickup,
  shipping_available,
  created_at,
  boardbag_size,
  brand,
  brand_id,
  model,
  listing_images ( id, url, thumbnail_url, is_primary, sort_order )
`

export type BoardbagsBrowseQueryInput = {
  facets: BoardbagsBrowseFacetSelections
  query?: string
  brand?: string
  minPrice?: number
  maxPrice?: number
  sort?: string
  page: number
  limit?: number
}

/** Paginated active boardbag listings for the /boardbags browse grid. */
export async function fetchBoardbagsBrowsePage(
  supabase: SupabaseClient,
  input: BoardbagsBrowseQueryInput,
): Promise<{ boardbags: BoardbagBrowseListingRow[]; totalPages: number }> {
  const limit = input.limit ?? BOARDBAGS_BROWSE_PAGE_SIZE
  const page = Math.max(1, input.page)
  const offset = (page - 1) * limit

  let q = supabase
    .from("listings")
    .select(BOARDBAG_BROWSE_LISTING_SELECT, { count: "exact" })
    .eq("section", BOARDBAGS_SECTION)
    .eq("status", "active")
    .eq("hidden_from_site", false)
    .is("archived_at", null)

  if (input.facets.conditions.length > 0) {
    q = q.in("condition", input.facets.conditions)
  }
  if (input.facets.sizes.length > 0) {
    q = q.in("boardbag_size", input.facets.sizes)
  }

  const brand = input.brand?.trim()
  if (brand) {
    q = q.ilike("brand", `%${brand}%`)
  }

  const query = input.query?.trim()
  if (query) {
    q = q.ilike("title", `%${query}%`)
  }

  if (input.minPrice != null && Number.isFinite(input.minPrice)) {
    q = q.gte("price", input.minPrice)
  }
  if (input.maxPrice != null && Number.isFinite(input.maxPrice)) {
    q = q.lte("price", input.maxPrice)
  }

  const sort = normalizedBoardbagsBrowseSort(input.sort)
  if (sort === "price-low") {
    q = q.order("price", { ascending: true })
  } else if (sort === "price-high") {
    q = q.order("price", { ascending: false })
  } else {
    q = q.order("created_at", { ascending: false })
  }

  q = q.range(offset, offset + limit - 1)

  const { data, count, error } = await q
  if (error) {
    console.error("fetchBoardbagsBrowsePage:", error.message)
    return { boardbags: [], totalPages: 0 }
  }

  return {
    boardbags: (data ?? []) as unknown as BoardbagBrowseListingRow[],
    totalPages: Math.ceil((count ?? 0) / limit),
  }
}

/** Active boardbag listing detail URLs (`/l/{slug-or-id}`) for the sitemap. */
export async function fetchBoardbagListingSitemapEntries(
  supabase: SupabaseClient,
): Promise<{ path: string; updatedAt: string | null }[]> {
  const { data, error } = await supabase
    .from("listings")
    .select("id, slug, updated_at")
    .eq("section", BOARDBAGS_SECTION)
    .eq("status", "active")
    .eq("hidden_from_site", false)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(48000)

  if (error) {
    console.error("fetchBoardbagListingSitemapEntries:", error.message)
    return []
  }

  return (data ?? []).map((row) => ({
    path: listingDetailHref({ id: row.id as string, slug: (row as { slug?: string | null }).slug }),
    updatedAt: (row as { updated_at?: string | null }).updated_at ?? null,
  }))
}
