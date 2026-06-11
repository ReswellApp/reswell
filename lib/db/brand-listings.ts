import type { SupabaseClient } from "@supabase/supabase-js"
import type { RecentListing } from "@/components/recent-feed-client"
import { boardLengthLabelFromDimensionsColumn } from "@/lib/listing-dimensions-storage"
import { fetchRecentlySoldSurfboardsConfirmedCheckoutOrdering } from "@/lib/db/home-recently-sold-strip"

const BRAND_MARKETPLACE_LISTING_SELECT = `
  id,
  slug,
  user_id,
  title,
  price,
  condition,
  section,
  status,
  city,
  state,
  shipping_available,
  local_pickup,
  board_type,
  dimensions,
  created_at,
  updated_at,
  listing_images (url, is_primary),
  profiles!listings_user_id_fkey (display_name, avatar_url, location, sales_count, shop_verified),
  categories (name, slug)
`

function escapeForOrFilter(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

interface BrandMarketplaceListingRow {
  id: string
  slug: string | null
  user_id: string
  title: string
  price: number
  condition: string
  section: string
  status?: string
  city?: string | null
  state?: string | null
  shipping_available?: boolean | null
  local_pickup?: boolean | null
  board_type?: string | null
  dimensions?: string | null
  updated_at?: string | null
  listing_images?: RecentListing["listing_images"]
  profiles?: RecentListing["profiles"]
  categories?: RecentListing["categories"]
}

function mapRowToRecentListing(row: BrandMarketplaceListingRow): RecentListing {
  const boardLength = boardLengthLabelFromDimensionsColumn(row.dimensions) ?? null
  return {
    id: row.id,
    slug: row.slug ?? null,
    user_id: row.user_id,
    title: row.title,
    price: row.price,
    condition: row.condition,
    section: row.section,
    status: row.status,
    city: row.city,
    state: row.state,
    shipping_available: row.shipping_available ?? undefined,
    local_pickup: row.local_pickup,
    board_type: row.board_type,
    board_length: boardLength,
    updated_at: row.updated_at ?? null,
    listing_images: row.listing_images,
    profiles: row.profiles,
    categories: row.categories,
  }
}

/**
 * Active marketplace listings linked to a directory brand (`brand_id`) or legacy `brand` text.
 * Matches `/search?brandSlug=` surfboard results (optional category filter).
 */
export async function listActiveListingsForBrand(
  supabase: SupabaseClient,
  brand: { id: string; name: string },
  options: { limit: number; categoryId?: string | null; sections?: string[] },
): Promise<RecentListing[]> {
  const { limit, categoryId = null, sections } = options
  const namePattern = `"%${escapeForOrFilter(brand.name)}%"`

  let q = supabase
    .from("listings")
    .select(BRAND_MARKETPLACE_LISTING_SELECT)
    .eq("status", "active")
    .eq("hidden_from_site", false)

  if (categoryId) {
    q = q.eq("category_id", categoryId)
  } else if (sections?.length) {
    q = q.in("section", sections)
  } else {
    /** Peer boards (`surfboards`) and shop inventory (`new`) both carry `brand_id` / `brand`. */
    q = q.in("section", ["surfboards", "new"])
  }

  q = q.or(`brand_id.eq.${brand.id},brand.ilike.${namePattern}`)
  q = q.order("created_at", { ascending: false }).limit(limit)

  const { data, error } = await q
  if (error) {
    console.error("[listActiveListingsForBrand]", error.message)
    return []
  }
  if (!data?.length) return []
  return (data as BrandMarketplaceListingRow[]).map(mapRowToRecentListing)
}

/**
 * Sold marketplace listings for a directory brand.
 * Surfboards must still be sold with a confirmed checkout; shop (`new`) rows use sold status only.
 */
export async function listRecentlySoldListingsForBrand(
  supabase: SupabaseClient,
  brand: { id: string; name: string },
  options: { limit: number; categoryId?: string | null },
): Promise<RecentListing[]> {
  const { limit, categoryId = null } = options
  const namePattern = `"%${escapeForOrFilter(brand.name)}%"`

  const { orderedListingIds: confirmedSurfboardIds, confirmedAtIsoByListingId } =
    await fetchRecentlySoldSurfboardsConfirmedCheckoutOrdering(supabase, 120)
  const confirmedSurfboardSet = new Set(confirmedSurfboardIds)

  let q = supabase
    .from("listings")
    .select(BRAND_MARKETPLACE_LISTING_SELECT)
    .eq("status", "sold")

  if (categoryId) {
    q = q.eq("category_id", categoryId)
  } else {
    q = q.in("section", ["surfboards", "new"])
  }

  q = q.or(`brand_id.eq.${brand.id},brand.ilike.${namePattern}`)
  q = q.order("updated_at", { ascending: false }).limit(Math.min(limit * 4, 120))

  const { data, error } = await q
  if (error) {
    console.error("[listRecentlySoldListingsForBrand]", error.message)
    return []
  }
  if (!data?.length) return []

  const rows = (data as BrandMarketplaceListingRow[]).filter((row) => {
    if (row.section === "surfboards") {
      return confirmedSurfboardSet.has(row.id)
    }
    return true
  })

  const surfboardsById = new Map(
    rows.filter((row) => row.section === "surfboards").map((row) => [row.id, row]),
  )
  const shopRows = rows.filter((row) => row.section !== "surfboards")

  const ordered: RecentListing[] = []

  for (const id of confirmedSurfboardIds) {
    const row = surfboardsById.get(id)
    if (!row) continue
    const mapped = mapRowToRecentListing(row)
    const confirmedAt = confirmedAtIsoByListingId.get(id)
    ordered.push(confirmedAt ? { ...mapped, updated_at: confirmedAt } : mapped)
    if (ordered.length >= limit) return ordered
  }

  for (const row of shopRows) {
    ordered.push(mapRowToRecentListing(row))
    if (ordered.length >= limit) return ordered
  }

  return ordered
}
