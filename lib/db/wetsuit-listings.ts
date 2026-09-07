/**
 * Data access for wetsuit listings. Wetsuits are `listings` rows
 * (section = 'wetsuits') with the wetsuit attributes stored directly on the row:
 * `wetsuit_size` (size), plus `brand`/`brand_id`/`model`.
 *
 * Mirrors the fin browse data layer (`lib/db/fin-listings.ts`) scoped to wetsuits.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { WETSUITS_SECTION } from "@/lib/wetsuit-listing-config"
import type { WetsuitsBrowseFacetSelections } from "@/lib/wetsuits-browse-facets"
import { normalizedWetsuitsBrowseSort } from "@/lib/wetsuits-browse-metadata"
import { listingDetailHref } from "@/lib/listing-href"

export const WETSUITS_BROWSE_PAGE_SIZE = 40

export type WetsuitListingImage = {
  id: string
  url: string
  thumbnail_url: string | null
  is_primary: boolean | null
  sort_order: number | null
}

export type WetsuitBrowseListingRow = {
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
  wetsuit_size: string | null
  brand: string | null
  brand_id: string | null
  model: string | null
  listing_images: WetsuitListingImage[] | null
}

const WETSUIT_BROWSE_LISTING_SELECT = `
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
  wetsuit_size,
  brand,
  brand_id,
  model,
  listing_images ( id, url, thumbnail_url, is_primary, sort_order )
`

export type WetsuitsBrowseQueryInput = {
  facets: WetsuitsBrowseFacetSelections
  query?: string
  brand?: string
  minPrice?: number
  maxPrice?: number
  sort?: string
  page: number
  limit?: number
}

/** Paginated active wetsuit listings for the /wetsuits browse grid. */
export async function fetchWetsuitsBrowsePage(
  supabase: SupabaseClient,
  input: WetsuitsBrowseQueryInput,
): Promise<{ wetsuits: WetsuitBrowseListingRow[]; totalPages: number }> {
  const limit = input.limit ?? WETSUITS_BROWSE_PAGE_SIZE
  const page = Math.max(1, input.page)
  const offset = (page - 1) * limit

  let q = supabase
    .from("listings")
    .select(WETSUIT_BROWSE_LISTING_SELECT, { count: "exact" })
    .eq("section", WETSUITS_SECTION)
    .eq("status", "active")
    .eq("hidden_from_site", false)
    .is("archived_at", null)

  if (input.facets.conditions.length > 0) {
    q = q.in("condition", input.facets.conditions)
  }
  if (input.facets.sizes.length > 0) {
    q = q.in("wetsuit_size", input.facets.sizes)
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

  const sort = normalizedWetsuitsBrowseSort(input.sort)
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
    console.error("fetchWetsuitsBrowsePage:", error.message)
    return { wetsuits: [], totalPages: 0 }
  }

  return {
    wetsuits: (data ?? []) as unknown as WetsuitBrowseListingRow[],
    totalPages: Math.ceil((count ?? 0) / limit),
  }
}

/** Active wetsuit listing detail URLs (`/l/{slug-or-id}`) for the sitemap. */
export async function fetchWetsuitListingSitemapEntries(
  supabase: SupabaseClient,
): Promise<{ path: string; updatedAt: string | null }[]> {
  const { data, error } = await supabase
    .from("listings")
    .select("id, slug, updated_at")
    .eq("section", WETSUITS_SECTION)
    .eq("status", "active")
    .eq("hidden_from_site", false)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(48000)

  if (error) {
    console.error("fetchWetsuitListingSitemapEntries:", error.message)
    return []
  }

  return (data ?? []).map((row) => ({
    path: listingDetailHref({ id: row.id as string, slug: (row as { slug?: string | null }).slug }),
    updatedAt: (row as { updated_at?: string | null }).updated_at ?? null,
  }))
}
