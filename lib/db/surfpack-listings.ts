/**
 * Data access for surfpack listings. Surfpacks are `listings` rows
 * (section = 'surfpacks') with the surfpack attributes stored directly on the row:
 * `surfpack_size` (size), plus `brand`/`brand_id`/`model`.
 *
 * Mirrors the fin browse data layer (`lib/db/fin-listings.ts`) scoped to surfpacks.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { SURFPACKS_SECTION } from "@/lib/surfpack-listing-config"
import type { SurfpacksBrowseFacetSelections } from "@/lib/surfpacks-browse-facets"
import { normalizedSurfpacksBrowseSort } from "@/lib/surfpacks-browse-metadata"
import { listingDetailHref } from "@/lib/listing-href"

export const SURFPACKS_BROWSE_PAGE_SIZE = 40

export type SurfpackListingImage = {
  id: string
  url: string
  thumbnail_url: string | null
  is_primary: boolean | null
  sort_order: number | null
}

export type SurfpackBrowseListingRow = {
  id: string
  slug: string | null
  user_id: string
  title: string
  price: number
  status: string
  condition: string | null
  local_pickup: boolean | null
  shipping_available: boolean | null
  created_at: string
  surfpack_size: string | null
  brand: string | null
  brand_id: string | null
  model: string | null
  listing_images: SurfpackListingImage[] | null
}

const SURFPACK_BROWSE_LISTING_SELECT = `
  id,
  slug,
  user_id,
  title,
  price,
  status,
  condition,
  local_pickup,
  shipping_available,
  created_at,
  surfpack_size,
  brand,
  brand_id,
  model,
  listing_images ( id, url, thumbnail_url, is_primary, sort_order )
`

export type SurfpacksBrowseQueryInput = {
  facets: SurfpacksBrowseFacetSelections
  query?: string
  brand?: string
  minPrice?: number
  maxPrice?: number
  sort?: string
  page: number
  limit?: number
}

/** Paginated active surfpack listings for the /surfpacks browse grid. */
export async function fetchSurfpacksBrowsePage(
  supabase: SupabaseClient,
  input: SurfpacksBrowseQueryInput,
): Promise<{ surfpacks: SurfpackBrowseListingRow[]; totalPages: number }> {
  const limit = input.limit ?? SURFPACKS_BROWSE_PAGE_SIZE
  const page = Math.max(1, input.page)
  const offset = (page - 1) * limit

  let q = supabase
    .from("listings")
    .select(SURFPACK_BROWSE_LISTING_SELECT, { count: "exact" })
    .eq("section", SURFPACKS_SECTION)
    .eq("status", "active")
    .eq("hidden_from_site", false)
    .is("archived_at", null)

  if (input.facets.conditions.length > 0) {
    q = q.in("condition", input.facets.conditions)
  }
  if (input.facets.sizes.length > 0) {
    q = q.in("surfpack_size", input.facets.sizes)
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

  const sort = normalizedSurfpacksBrowseSort(input.sort)
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
    console.error("fetchSurfpacksBrowsePage:", error.message)
    return { surfpacks: [], totalPages: 0 }
  }

  return {
    surfpacks: (data ?? []) as unknown as SurfpackBrowseListingRow[],
    totalPages: Math.ceil((count ?? 0) / limit),
  }
}

/** Active surfpack listing detail URLs (`/l/{slug-or-id}`) for the sitemap. */
export async function fetchSurfpackListingSitemapEntries(
  supabase: SupabaseClient,
): Promise<{ path: string; updatedAt: string | null }[]> {
  const { data, error } = await supabase
    .from("listings")
    .select("id, slug, updated_at")
    .eq("section", SURFPACKS_SECTION)
    .eq("status", "active")
    .eq("hidden_from_site", false)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(48000)

  if (error) {
    console.error("fetchSurfpackListingSitemapEntries:", error.message)
    return []
  }

  return (data ?? []).map((row) => ({
    path: listingDetailHref({ id: row.id as string, slug: (row as { slug?: string | null }).slug }),
    updatedAt: (row as { updated_at?: string | null }).updated_at ?? null,
  }))
}
