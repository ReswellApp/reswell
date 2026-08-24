import type { SupabaseClient } from "@supabase/supabase-js"
import { listingIdsBlockedFromPermanentDelete } from "@/lib/db/listingDeleteEligibility"
import { isPeerListingSection } from "@/lib/peer-listing-sections"
import type { ListingCartOfferProspect } from "@/lib/types/listing-cart-holders"

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
  compare_at_price: number | null
  status: string
  section: string
  condition: string | null
  brand: string | null
  model: string | null
  views: number
  cartCount: number
  favoriteCount: number
  created_at: string
  archived_at: string | null
  hidden_from_site: boolean | null
  sold_off_platform: boolean | null
  canDelete: boolean
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
  "id, slug, title, price, compare_at_price, status, section, condition, brand, model, views, created_at, archived_at, hidden_from_site, sold_off_platform, listing_images(url, thumbnail_url, is_primary)"

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

async function fetchMyListingsEngagementCounts(
  supabase: SupabaseClient,
): Promise<Map<string, { cartCount: number; favoriteCount: number }>> {
  const { data, error } = await supabase.rpc("get_my_listings_engagement_counts")
  if (error) {
    console.error("[fetchMyListingsEngagementCounts] rpc", error.message)
    return new Map()
  }

  const rows = Array.isArray(data) ? data : []
  const counts = new Map<string, { cartCount: number; favoriteCount: number }>()
  for (const row of rows) {
    if (!row || typeof row !== "object") continue
    const record = row as Record<string, unknown>
    const listingId = typeof record.listing_id === "string" ? record.listing_id : null
    if (!listingId) continue
    counts.set(listingId, {
      cartCount: toCount(record.cart_count),
      favoriteCount: toCount(record.favorite_count),
    })
  }
  return counts
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
  const [listingsRes, stats, engagementCounts] = await Promise.all([
    supabase
      .from("listings")
      .select(MY_LISTINGS_SELECT)
      .eq("user_id", userId)
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
    fetchMyListingsDashboardStats(supabase),
    fetchMyListingsEngagementCounts(supabase),
  ])

  if (listingsRes.error) {
    return { listings: [], stats: EMPTY_STATS, error: listingsRes.error.message }
  }

  const listingRows = (listingsRes.data ?? []) as Omit<
    MyListingRow,
    "cartCount" | "favoriteCount" | "canDelete"
  >[]
  const blockedIds = await listingIdsBlockedFromPermanentDelete(
    supabase,
    listingRows.map((listing) => listing.id),
  )
  const listings = listingRows.map((listing) => {
    const engagement = engagementCounts.get(listing.id)
    return {
      ...listing,
      cartCount: engagement?.cartCount ?? 0,
      favoriteCount: engagement?.favoriteCount ?? 0,
      canDelete: !blockedIds.has(listing.id),
    }
  })

  return { listings, stats }
}

/** Active peer listings the seller owns that currently have buyers in cart. */
export async function fetchMyListingCartOfferProspects(
  supabase: SupabaseClient,
  userId: string,
): Promise<ListingCartOfferProspect[]> {
  const engagementCounts = await fetchMyListingsEngagementCounts(supabase)
  const ids = [...engagementCounts.entries()]
    .filter(([, engagement]) => engagement.cartCount > 0)
    .map(([listingId]) => listingId)
  if (ids.length === 0) return []

  const { data, error } = await supabase
    .from("listings")
    .select("id, title, price, status, section, hidden_from_site")
    .eq("user_id", userId)
    .in("id", ids)
    .in("status", ["active", "pending_sale"])
    .eq("hidden_from_site", false)

  if (error) {
    console.error("[fetchMyListingCartOfferProspects]", error.message)
    return []
  }

  const prospects: ListingCartOfferProspect[] = []
  for (const row of data ?? []) {
    if (!isPeerListingSection(row.section)) continue
    const cartCount = engagementCounts.get(row.id)?.cartCount ?? 0
    if (cartCount <= 0) continue
    const price = Number.parseFloat(String(row.price ?? 0))
    prospects.push({
      id: row.id,
      title: (row.title ?? "").trim() || "Listing",
      cartCount,
      price: Number.isFinite(price) ? price : 0,
    })
  }

  return prospects.sort((a, b) => b.cartCount - a.cartCount)
}
