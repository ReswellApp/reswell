import type { SupabaseClient } from "@supabase/supabase-js"

export type MyListingImageRow = {
  url: string
  thumbnail_url?: string | null
  is_primary: boolean | null
}

export type MyListingRow = {
  id: string
  slug: string | null
  title: string
  price: number
  status: string
  section: string
  condition: string | null
  brand: string | null
  model: string | null
  views: number
  created_at: string
  archived_at: string | null
  hidden_from_site: boolean | null
  listing_images: MyListingImageRow[] | null
}

export type MyListingsDashboardStats = {
  totalListings: number
  totalViews: number
  inCarts: number
  saved: number
}

export type FetchMyListingsResult = {
  listings: MyListingRow[]
  stats: MyListingsDashboardStats
  error?: string
}

const MY_LISTINGS_SELECT =
  "id, slug, title, price, status, section, condition, brand, model, views, created_at, archived_at, hidden_from_site, listing_images(url, thumbnail_url, is_primary)"

const EMPTY_STATS: MyListingsDashboardStats = {
  totalListings: 0,
  totalViews: 0,
  inCarts: 0,
  saved: 0,
}

function toCount(value: unknown): number {
  if (value == null) return 0
  return typeof value === "number" ? value : Number(value) || 0
}

export async function fetchMyListingsDashboardStats(
  supabase: SupabaseClient,
): Promise<MyListingsDashboardStats> {
  const { data, error } = await supabase.rpc("get_my_listings_dashboard_stats")
  if (error) {
    console.error("[fetchMyListingsDashboardStats] rpc", error.message)
    return EMPTY_STATS
  }

  const row = Array.isArray(data) ? data[0] : data
  if (!row || typeof row !== "object") {
    return EMPTY_STATS
  }

  const stats = row as Record<string, unknown>
  return {
    totalListings: toCount(stats.total_listings),
    totalViews: toCount(stats.total_views),
    inCarts: toCount(stats.in_carts),
    saved: toCount(stats.saved),
  }
}

export async function fetchMyListings(
  supabase: SupabaseClient,
  userId: string,
): Promise<FetchMyListingsResult> {
  const [listingsRes, stats] = await Promise.all([
    supabase
      .from("listings")
      .select(MY_LISTINGS_SELECT)
      .eq("user_id", userId)
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
    fetchMyListingsDashboardStats(supabase),
  ])

  if (listingsRes.error) {
    return { listings: [], stats: EMPTY_STATS, error: listingsRes.error.message }
  }

  return { listings: (listingsRes.data ?? []) as MyListingRow[], stats }
}
