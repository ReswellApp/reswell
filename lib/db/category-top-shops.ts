import type { SupabaseClient } from "@supabase/supabase-js"
import type { ListingImageForCard } from "@/lib/listing-image-display"
import { REAL_MARKETPLACE_SALES_FILTER } from "@/lib/order-admin-test"
import type { CategoryTopShopSection } from "@/lib/types/category-top-shops"

export const CATEGORY_TOP_SHOPS_LISTINGS_FETCH_CAP = 4000
export const CATEGORY_TOP_SHOPS_ORDERS_FETCH_CAP = 4000

const COMPLETED_FULFILLMENT_METHODS = ["shipping", "pickup"] as const

export type CategoryTopShopListingRow = {
  user_id: string
  city: string | null
  state: string | null
  shipping_available: boolean | null
  listing_images: ListingImageForCard[] | null
}

export type CategoryTopShopProfileRow = {
  id: string
  seller_slug: string | null
  display_name: string | null
  avatar_url: string | null
  city: string | null
  is_shop: boolean | null
  shop_name: string | null
  shop_logo_url: string | null
  shop_verified: boolean | null
}

export type CategoryTopShopCompletedSaleRow = {
  sellerId: string
  fulfillmentMethod: "shipping" | "pickup"
}

const PROFILE_FIELDS =
  "id, seller_slug, display_name, avatar_url, city, is_shop, shop_name, shop_logo_url, shop_verified" as const

function unwrapSection(
  listings:
    | { section: string | null }
    | { section: string | null }[]
    | null
    | undefined,
): string | null {
  if (listings == null) return null
  const row = Array.isArray(listings) ? listings[0] : listings
  const section = row?.section
  return typeof section === "string" && section.trim() ? section : null
}

function asFulfillmentMethod(value: string | null | undefined): "shipping" | "pickup" | null {
  if (value === "shipping" || value === "pickup") return value
  return null
}

/**
 * Confirmed marketplace checkouts in a category that actually shipped or were
 * picked up. Requires a client that can read `orders` (service role).
 */
export async function listCategoryCompletedFulfillmentSales(
  supabase: SupabaseClient,
  section: CategoryTopShopSection,
): Promise<CategoryTopShopCompletedSaleRow[]> {
  const [
    { data: itemRows, error: itemsError },
    { data: orderRows, error: ordersError },
  ] = await Promise.all([
    supabase
      .from("order_items")
      .select(
        "listing_id, order_id, orders!inner(seller_id, status, fulfillment_method, is_admin_test), listings:listing_id(section)",
      )
      .eq("orders.status", "confirmed")
      .eq("orders.is_admin_test", REAL_MARKETPLACE_SALES_FILTER.is_admin_test)
      .in("orders.fulfillment_method", [...COMPLETED_FULFILLMENT_METHODS])
      .limit(CATEGORY_TOP_SHOPS_ORDERS_FETCH_CAP),
    supabase
      .from("orders")
      .select("id, seller_id, fulfillment_method, listing_id, listings:listing_id(section)")
      .eq("status", "confirmed")
      .match(REAL_MARKETPLACE_SALES_FILTER)
      .in("fulfillment_method", [...COMPLETED_FULFILLMENT_METHODS])
      .limit(CATEGORY_TOP_SHOPS_ORDERS_FETCH_CAP),
  ])

  if (itemsError) {
    console.error("[category-top-shops] completed order items:", itemsError.message)
  }
  if (ordersError) {
    console.error("[category-top-shops] completed orders:", ordersError.message)
  }

  const sales: CategoryTopShopCompletedSaleRow[] = []
  const ordersWithItems = new Set<string>()

  for (const row of itemRows ?? []) {
    const order = row.orders as
      | { seller_id?: string | null; fulfillment_method?: string | null }
      | { seller_id?: string | null; fulfillment_method?: string | null }[]
      | null
    const orderRow = Array.isArray(order) ? order[0] : order
    const sellerId = typeof orderRow?.seller_id === "string" ? orderRow.seller_id : ""
    const fulfillmentMethod = asFulfillmentMethod(orderRow?.fulfillment_method ?? null)
    const orderId = typeof row.order_id === "string" ? row.order_id : ""
    if (orderId) ordersWithItems.add(orderId)
    if (!sellerId || !fulfillmentMethod) continue
    if (unwrapSection(row.listings as { section: string | null } | { section: string | null }[] | null) !== section) {
      continue
    }
    sales.push({ sellerId, fulfillmentMethod })
  }

  for (const row of orderRows ?? []) {
    const orderId = typeof row.id === "string" ? row.id : ""
    if (orderId && ordersWithItems.has(orderId)) continue
    const sellerId = typeof row.seller_id === "string" ? row.seller_id : ""
    const fulfillmentMethod = asFulfillmentMethod(row.fulfillment_method)
    if (!sellerId || !fulfillmentMethod) continue
    if (unwrapSection(row.listings as { section: string | null } | { section: string | null }[] | null) !== section) {
      continue
    }
    sales.push({ sellerId, fulfillmentMethod })
  }

  return sales
}

export async function listCategoryListingsForSellers(
  supabase: SupabaseClient,
  section: CategoryTopShopSection,
  sellerIds: string[],
  status: "active" | "sold",
): Promise<CategoryTopShopListingRow[]> {
  if (sellerIds.length === 0) return []

  let query = supabase
    .from("listings")
    .select("user_id, city, state, shipping_available, listing_images (url, thumbnail_url, is_primary)")
    .eq("section", section)
    .eq("status", status)
    .eq("hidden_from_site", false)
    .is("archived_at", null)
    .in("user_id", sellerIds)
    .limit(CATEGORY_TOP_SHOPS_LISTINGS_FETCH_CAP)

  if (status === "active") {
    query = query.order("created_at", { ascending: false })
  }

  const { data, error } = await query

  if (error) {
    console.error(`[category-top-shops] ${status} listings:`, error.message)
    return []
  }

  return (data ?? []) as CategoryTopShopListingRow[]
}

export async function listCategoryTopShopProfiles(
  supabase: SupabaseClient,
  sellerIds: string[],
): Promise<CategoryTopShopProfileRow[]> {
  if (sellerIds.length === 0) return []

  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_FIELDS)
    .in("id", sellerIds)

  if (error) {
    console.error("[category-top-shops] profiles:", error.message)
    return []
  }

  return (data ?? []) as CategoryTopShopProfileRow[]
}

export async function listCategoryTopShopReviewRows(
  supabase: SupabaseClient,
  sellerIds: string[],
): Promise<{ reviewed_id: string; rating: number }[]> {
  if (sellerIds.length === 0) return []

  const { data, error } = await supabase
    .from("reviews")
    .select("reviewed_id, rating")
    .in("reviewed_id", sellerIds)

  if (error) {
    console.error("[category-top-shops] reviews:", error.message)
    return []
  }

  return (data ?? []) as { reviewed_id: string; rating: number }[]
}
