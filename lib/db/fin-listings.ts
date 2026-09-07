/**
 * Data access for fin listings. Fins are `listings` rows (section = 'fins')
 * with the fin attributes stored directly on the row: `fins_setup` (setup,
 * comma-serialized), `fin_system` (system), `fin_size` (size), plus
 * `brand`/`brand_id`/`model`.
 *
 * Mirrors the surfboard browse data layer (`lib/db/boards-browse-listings.ts`)
 * but scoped to fins.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { FINS_SECTION } from "@/lib/fin-listing-config"
import type { FinsBrowseFacetSelections } from "@/lib/fins-browse-facets"
import { normalizedFinsBrowseSort } from "@/lib/fins-browse-metadata"
import {
  finSetupFilterPatterns,
  finSystemFilterPatterns,
} from "@/lib/fin-listing-effective-facets"
import { listingDetailHref } from "@/lib/listing-href"

export const FINS_BROWSE_PAGE_SIZE = 40

export type FinListingImage = {
  id: string
  url: string
  thumbnail_url: string | null
  is_primary: boolean | null
  sort_order: number | null
}

export type FinAttributes = {
  fin_size: string | null
  brand: string | null
  brand_id: string | null
  model: string | null
  fins_setup: string | null
  fin_system: string | null
}

export type FinBrowseListingRow = {
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
  fin_size: string | null
  brand: string | null
  brand_id: string | null
  model: string | null
  fins_setup: string | null
  fin_system: string | null
  listing_images: FinListingImage[] | null
}

function escapePostgrestIlikeFragment(fragment: string): string {
  return fragment.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

const FIN_BROWSE_LISTING_SELECT = `
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
  fin_size,
  brand,
  brand_id,
  model,
  fins_setup,
  fin_system,
  listing_images ( id, url, thumbnail_url, is_primary, sort_order )
`

function facetOrGroups(patternsForSlug: (slug: string) => string[], slugs: string[]): string | null {
  const groups: string[] = []
  for (const slug of slugs) {
    groups.push(...patternsForSlug(slug))
  }
  return groups.length ? groups.join(",") : null
}

export type FinsBrowseQueryInput = {
  facets: FinsBrowseFacetSelections
  query?: string
  brand?: string
  minPrice?: number
  maxPrice?: number
  sort?: string
  page: number
  limit?: number
}

/** Paginated active fin listings for the /fins browse grid. */
export async function fetchFinsBrowsePage(
  supabase: SupabaseClient,
  input: FinsBrowseQueryInput,
): Promise<{ fins: FinBrowseListingRow[]; totalPages: number }> {
  const limit = input.limit ?? FINS_BROWSE_PAGE_SIZE
  const page = Math.max(1, input.page)
  const offset = (page - 1) * limit

  let q = supabase
    .from("listings")
    .select(FIN_BROWSE_LISTING_SELECT, { count: "exact" })
    .eq("section", FINS_SECTION)
    .eq("status", "active")
    .eq("hidden_from_site", false)
    .is("archived_at", null)

  if (input.facets.conditions.length > 0) {
    q = q.in("condition", input.facets.conditions)
  }
  if (input.facets.finSetups.length > 0) {
    const finOr = facetOrGroups(finSetupFilterPatterns, input.facets.finSetups)
    if (finOr) q = q.or(finOr)
  }
  if (input.facets.finSystems.length > 0) {
    const finSystemOr = facetOrGroups(finSystemFilterPatterns, input.facets.finSystems)
    if (finSystemOr) q = q.or(finSystemOr)
  }
  if (input.facets.sizes.length > 0) {
    q = q.in("fin_size", input.facets.sizes)
  }

  const brand = input.brand?.trim()
  if (brand) {
    q = q.ilike("brand", `%${brand}%`)
  }

  const query = input.query?.trim()
  if (query) {
    const pat = `"%${escapePostgrestIlikeFragment(query)}%"`
    q = q.or(
      `title.ilike.${pat},description.ilike.${pat},brand.ilike.${pat},model.ilike.${pat},fins_setup.ilike.${pat},fin_system.ilike.${pat}`,
    )
  }

  if (input.minPrice != null && Number.isFinite(input.minPrice)) {
    q = q.gte("price", input.minPrice)
  }
  if (input.maxPrice != null && Number.isFinite(input.maxPrice)) {
    q = q.lte("price", input.maxPrice)
  }

  const sort = normalizedFinsBrowseSort(input.sort)
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
    console.error("fetchFinsBrowsePage:", error.message)
    return { fins: [], totalPages: 0 }
  }

  return {
    fins: (data ?? []) as unknown as FinBrowseListingRow[],
    totalPages: Math.ceil((count ?? 0) / limit),
  }
}

/** Active fin listing detail URLs (`/l/{slug-or-id}`) for the sitemap. */
export async function fetchFinListingSitemapEntries(
  supabase: SupabaseClient,
): Promise<{ path: string; updatedAt: string | null }[]> {
  const { data, error } = await supabase
    .from("listings")
    .select("id, slug, updated_at")
    .eq("section", FINS_SECTION)
    .eq("status", "active")
    .eq("hidden_from_site", false)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(48000)

  if (error) {
    console.error("fetchFinListingSitemapEntries:", error.message)
    return []
  }

  return (data ?? []).map((row) => ({
    path: listingDetailHref({ id: row.id as string, slug: (row as { slug?: string | null }).slug }),
    updatedAt: (row as { updated_at?: string | null }).updated_at ?? null,
  }))
}
