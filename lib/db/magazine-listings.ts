import type { SupabaseClient } from "@supabase/supabase-js"
import { MAGAZINES_SECTION } from "@/lib/magazine-listing-config"
import type { MagazinesBrowseFacetSelections } from "@/lib/magazines-browse-facets"
import { normalizedMagazinesBrowseSort } from "@/lib/magazines-browse-metadata"
import { listingDetailHref } from "@/lib/listing-href"

export const MAGAZINES_BROWSE_PAGE_SIZE = 40

export type MagazineBrowseListingRow = {
  id: string
  slug: string | null
  user_id: string
  title: string
  price: number
  status: string
  condition: string | null
  shipping_available: boolean | null
  created_at: string
  magazine_year: number | null
  brand: string | null
  listing_images: {
    id: string
    url: string
    thumbnail_url: string | null
    is_primary: boolean | null
    sort_order: number | null
  }[] | null
}

const MAGAZINE_BROWSE_LISTING_SELECT = `
  id,
  slug,
  user_id,
  title,
  price,
  status,
  condition,
  shipping_available,
  created_at,
  magazine_year,
  brand,
  listing_images ( id, url, thumbnail_url, is_primary, sort_order )
`

export type MagazinesBrowseQueryInput = {
  facets: MagazinesBrowseFacetSelections
  query?: string
  brand?: string
  minPrice?: number
  maxPrice?: number
  minYear?: number
  maxYear?: number
  sort?: string
  page: number
  limit?: number
}

export async function fetchMagazinesBrowsePage(
  supabase: SupabaseClient,
  input: MagazinesBrowseQueryInput,
): Promise<{ magazines: MagazineBrowseListingRow[]; totalPages: number }> {
  const limit = input.limit ?? MAGAZINES_BROWSE_PAGE_SIZE
  const page = Math.max(1, input.page)
  const offset = (page - 1) * limit

  let q = supabase
    .from("listings")
    .select(MAGAZINE_BROWSE_LISTING_SELECT, { count: "exact" })
    .eq("section", MAGAZINES_SECTION)
    .eq("status", "active")
    .eq("hidden_from_site", false)
    .is("archived_at", null)

  if (input.facets.conditions.length > 0) {
    q = q.in("condition", input.facets.conditions)
  }

  const brand = input.brand?.trim()
  if (brand) {
    q = q.ilike("brand", `%${brand}%`)
  }

  const query = input.query?.trim()
  if (query) {
    q = q.or(`title.ilike.%${query}%,brand.ilike.%${query}%`)
  }

  if (input.minPrice != null && Number.isFinite(input.minPrice)) {
    q = q.gte("price", input.minPrice)
  }
  if (input.maxPrice != null && Number.isFinite(input.maxPrice)) {
    q = q.lte("price", input.maxPrice)
  }
  if (input.minYear != null && Number.isFinite(input.minYear)) {
    q = q.gte("magazine_year", input.minYear)
  }
  if (input.maxYear != null && Number.isFinite(input.maxYear)) {
    q = q.lte("magazine_year", input.maxYear)
  }

  const sort = normalizedMagazinesBrowseSort(input.sort)
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
    console.error("fetchMagazinesBrowsePage:", error.message)
    return { magazines: [], totalPages: 0 }
  }

  return {
    magazines: (data ?? []) as unknown as MagazineBrowseListingRow[],
    totalPages: Math.ceil((count ?? 0) / limit),
  }
}

export async function fetchMagazineListingSitemapEntries(
  supabase: SupabaseClient,
): Promise<{ path: string; updatedAt: string | null }[]> {
  const { data, error } = await supabase
    .from("listings")
    .select("id, slug, updated_at")
    .eq("section", MAGAZINES_SECTION)
    .eq("status", "active")
    .eq("hidden_from_site", false)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(48000)

  if (error) {
    console.error("fetchMagazineListingSitemapEntries:", error.message)
    return []
  }

  return (data ?? []).map((row) => ({
    path: listingDetailHref({ id: row.id as string, slug: (row as { slug?: string | null }).slug }),
    updatedAt: (row as { updated_at?: string | null }).updated_at ?? null,
  }))
}
