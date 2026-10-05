import type { SupabaseClient } from "@supabase/supabase-js"
import {
  listingIdsBlockedFromPermanentDelete,
  listingIdsWithOpenMarketplaceCheckout,
} from "@/lib/db/listingDeleteEligibility"
import { listingCanShowSellerRelist } from "@/lib/listing-sold-state"
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
  site_visibility_reason: string | null
  description: string | null
  shipping_package_tier: string | null
  shipping_package_band: string | null
  shipping_packed_length_in: number | null
  shipping_packed_width_in: number | null
  shipping_packed_height_in: number | null
  shipping_packed_weight_oz: number | null
  city: string | null
  state: string | null
  latitude: number | null
  longitude: number | null
  local_pickup: boolean | null
  shipping_available: boolean | null
  board_shipping_cost_mode: string | null
  shipping_price: number | null
  dropoff_location_id: string | null
  dimensions: string | null
  length_total_inches: number | null
  volume_liters: number | null
  fins_setup: string | null
  fin_system: string | null
  construction: string | null
  fins_included: boolean | null
  tail_shape: string | null
  fin_size: string | null
  wetsuit_size: string | null
  apparel_kind: string | null
  traction_size: string | null
  sold_off_platform: boolean | null
  canDelete: boolean
  canRelist: boolean
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
  "id, slug, title, description, price, compare_at_price, status, section, condition, brand, model, city, state, latitude, longitude, local_pickup, shipping_available, board_shipping_cost_mode, shipping_price, dropoff_location_id, dimensions, length_total_inches, volume_liters, fins_setup, fin_system, construction, fins_included, tail_shape, fin_size, wetsuit_size, apparel_kind, traction_size, views, created_at, archived_at, hidden_from_site, site_visibility_reason, sold_off_platform, shipping_package_tier, shipping_package_band, shipping_packed_length_in, shipping_packed_width_in, shipping_packed_height_in, shipping_packed_weight_oz, listing_images(url, thumbnail_url, is_primary)"

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

function toNumberOrNull(value: unknown): number | null {
  if (value == null || value === "") return null
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) ? n : null
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
    "cartCount" | "favoriteCount" | "canDelete" | "canRelist"
  >[]
  const soldIds = listingRows
    .filter((listing) => listing.status === "sold")
    .map((listing) => listing.id)
  const [blockedIds, checkoutSold] = await Promise.all([
    listingIdsBlockedFromPermanentDelete(
      supabase,
      listingRows.map((listing) => listing.id),
    ),
    listingIdsWithOpenMarketplaceCheckout(supabase, soldIds),
  ])
  const listings = listingRows.map((listing) => {
    const engagement = engagementCounts.get(listing.id)
    return {
      ...listing,
      description: typeof listing.description === "string" ? listing.description : null,
      site_visibility_reason:
        typeof listing.site_visibility_reason === "string" ? listing.site_visibility_reason : null,
      shipping_package_tier: listing.shipping_package_tier ?? null,
      shipping_package_band: listing.shipping_package_band ?? null,
      shipping_packed_length_in: toNumberOrNull(listing.shipping_packed_length_in),
      shipping_packed_width_in: toNumberOrNull(listing.shipping_packed_width_in),
      shipping_packed_height_in: toNumberOrNull(listing.shipping_packed_height_in),
      shipping_packed_weight_oz: toNumberOrNull(listing.shipping_packed_weight_oz),
      brand: typeof listing.brand === "string" ? listing.brand : null,
      model: typeof listing.model === "string" ? listing.model : null,
      city: typeof listing.city === "string" ? listing.city : null,
      state: typeof listing.state === "string" ? listing.state : null,
      latitude: toNumberOrNull(listing.latitude),
      longitude: toNumberOrNull(listing.longitude),
      local_pickup: listing.local_pickup === false ? false : listing.local_pickup === true ? true : null,
      shipping_available: listing.shipping_available === true,
      board_shipping_cost_mode:
        listing.board_shipping_cost_mode === "reswell" ||
        listing.board_shipping_cost_mode === "flat" ||
        listing.board_shipping_cost_mode === "free"
          ? listing.board_shipping_cost_mode
          : null,
      shipping_price: toNumberOrNull(listing.shipping_price),
      dropoff_location_id:
        typeof listing.dropoff_location_id === "string" ? listing.dropoff_location_id : null,
      dimensions: typeof listing.dimensions === "string" ? listing.dimensions : null,
      length_total_inches: toNumberOrNull(listing.length_total_inches),
      volume_liters: toNumberOrNull(listing.volume_liters),
      fins_setup: typeof listing.fins_setup === "string" ? listing.fins_setup : null,
      fin_system: typeof listing.fin_system === "string" ? listing.fin_system : null,
      construction: typeof listing.construction === "string" ? listing.construction : null,
      fins_included: listing.fins_included === true ? true : listing.fins_included === false ? false : null,
      tail_shape: typeof listing.tail_shape === "string" ? listing.tail_shape : null,
      fin_size: typeof listing.fin_size === "string" ? listing.fin_size : null,
      wetsuit_size: typeof listing.wetsuit_size === "string" ? listing.wetsuit_size : null,
      apparel_kind: typeof listing.apparel_kind === "string" ? listing.apparel_kind : null,
      traction_size: typeof listing.traction_size === "string" ? listing.traction_size : null,
      cartCount: engagement?.cartCount ?? 0,
      favoriteCount: engagement?.favoriteCount ?? 0,
      canDelete: !blockedIds.has(listing.id),
      canRelist: listingCanShowSellerRelist(
        listing,
        checkoutSold.listingIds.has(listing.id),
      ),
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
