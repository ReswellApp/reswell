import type { SupabaseClient } from "@supabase/supabase-js"
import type { RecentListing } from "@/components/recent-feed-client"
import { formatDecimalDimension } from "@/lib/board-measurements"

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
  length_feet,
  length_inches,
  created_at,
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
  length_feet?: number | null
  length_inches?: number | string | null
  listing_images?: RecentListing["listing_images"]
  profiles?: RecentListing["profiles"]
  categories?: RecentListing["categories"]
}

function mapRowToRecentListing(row: BrandMarketplaceListingRow): RecentListing {
  const inchesNum =
    row.length_inches != null && Number.isFinite(Number(row.length_inches))
      ? Number(row.length_inches)
      : null
  const boardLength =
    row.length_feet != null && inchesNum != null
      ? `${row.length_feet}'${formatDecimalDimension(inchesNum) || "0"}"`
      : row.length_feet != null
        ? `${row.length_feet}'`
        : null
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
  options: { limit: number; categoryId?: string | null },
): Promise<RecentListing[]> {
  const { limit, categoryId = null } = options
  const namePattern = `"%${escapeForOrFilter(brand.name)}%"`

  let q = supabase
    .from("listings")
    .select(BRAND_MARKETPLACE_LISTING_SELECT)
    .eq("status", "active")
    .eq("hidden_from_site", false)

  if (categoryId) {
    q = q.eq("category_id", categoryId)
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
