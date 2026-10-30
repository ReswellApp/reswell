import { MOBILE_LISTING_SELECT, type MobileListingRow } from "@/lib/db/mobile-listings"
import { ORDER_STATUS_LIST } from "@/lib/order-status"
import { REAL_MARKETPLACE_PURCHASES_FILTER } from "@/lib/order-admin-test"
import { getDb } from "@/lib/supabase/db"
import type { SupabaseClient } from "@supabase/supabase-js"

export type MobileFavoriteRow = {
  id: string
  created_at: string
  listing: MobileListingRow | null
}

export type MobileFollowedSellerRow = {
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

export type MobileCartRow = {
  quantity: number | null
  listing: MobileListingRow | null
}

export type MobileOrderRow = {
  id: string
  order_num: string | null
  amount: number | string | null
  seller_earnings: number | string | null
  status: string
  delivery_status: string | null
  tracking_number: string | null
  created_at: string
  fulfillment_method: string | null
  listing: {
    id: string
    title: string | null
    listing_images: MobileListingRow["listing_images"]
  } | null
  counterparty_name: string | null
}

export type MobileReviewRow = {
  id: string
  rating: number | string | null
  comment: string | null
  created_at: string
  reviewer_name: string | null
  listing_seller_id: string | null
}

export type MobileMessageRow = {
  id: string
  content: string | null
  sender_id: string
  created_at: string
  metadata?: unknown
  offer_id?: string | null
}

type QueryResult<T> = { ok: true; rows: T } | { ok: false; message: string }

function one<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

export async function listMobileFavoriteRows(
  supabase: SupabaseClient,
  userId: string,
): Promise<QueryResult<MobileFavoriteRow[]>> {
  const { data, error } = await supabase
    .from("favorites")
    .select(`id, created_at, listing:listings (${MOBILE_LISTING_SELECT})`)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1000)

  if (error) return { ok: false, message: error.message }

  const rows = (data ?? []).map((row) => {
    const raw = row as { id: string; created_at: string; listing: MobileListingRow | MobileListingRow[] | null }
    return { id: raw.id, created_at: raw.created_at, listing: one(raw.listing) }
  })
  return { ok: true, rows }
}

export async function listMobileFollowers(
  supabase: SupabaseClient,
  userId: string,
): Promise<QueryResult<MobileFollowedSellerRow[]>> {
  const { data, error } = await supabase
    .from("seller_follows")
    .select("follower_id")
    .eq("seller_id", userId)
    .limit(100)

  if (error) return { ok: false, message: error.message }
  const ids = [...new Set((data ?? []).map((row) => String((row as { follower_id?: string }).follower_id ?? "")).filter(Boolean))]
  if (ids.length === 0) return { ok: true, rows: [] }

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, seller_slug, display_name, avatar_url, city, is_shop, shop_name, shop_logo_url, shop_verified")
    .in("id", ids)

  if (profileError) return { ok: false, message: profileError.message }
  return { ok: true, rows: (profiles ?? []) as MobileFollowedSellerRow[] }
}

export type MobileDashboardFacts = {
  following_count: number
  favorite_count: number
  purchase_count: number
  sale_count: number
  pending_offer_count: number
  unread_message_count: number
  active_listing_count: number
  wallet_balance_usd: number
}

export async function fetchMobileDashboardFacts(
  supabase: SupabaseClient,
  userId: string,
): Promise<QueryResult<MobileDashboardFacts>> {
  const [following, favorites, purchases, sales, offers, profile, listings, wallet] = await Promise.all([
    supabase.from("seller_follows").select("id", { count: "exact", head: true }).eq("follower_id", userId),
    supabase.from("favorites").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("buyer_id", userId)
      .match(REAL_MARKETPLACE_PURCHASES_FILTER)
      .in("status", [...ORDER_STATUS_LIST]),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("seller_id", userId)
      .match(REAL_MARKETPLACE_PURCHASES_FILTER)
      .in("status", [...ORDER_STATUS_LIST]),
    supabase.from("offers").select("id", { count: "exact", head: true }).eq("seller_id", userId).eq("status", "PENDING"),
    supabase.from("profiles").select("unread_message_count").eq("id", userId).maybeSingle(),
    supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "active")
      .is("archived_at", null),
    supabase.from("wallets").select("balance").eq("user_id", userId).maybeSingle(),
  ])

  const failed = [following, favorites, purchases, sales, offers, profile, listings, wallet].find((result) => result.error)
  if (failed?.error) return { ok: false, message: failed.error.message }

  const balance = usd(wallet.data?.balance)
  return {
    ok: true,
    rows: {
      following_count: following.count ?? 0,
      favorite_count: favorites.count ?? 0,
      purchase_count: purchases.count ?? 0,
      sale_count: sales.count ?? 0,
      pending_offer_count: offers.count ?? 0,
      unread_message_count: Math.max(0, Math.floor(Number(profile.data?.unread_message_count) || 0)),
      active_listing_count: listings.count ?? 0,
      wallet_balance_usd: balance,
    },
  }
}

export type MobileDashboardAccess = {
  isAdmin: boolean
  isShipper: boolean
  hasShopifyAccess: boolean
  hasSellerProfile: boolean
}

/** Flags that decide which dashboard sections this account can open. */
export async function fetchMobileDashboardAccess(
  supabase: SupabaseClient,
  userId: string,
): Promise<QueryResult<MobileDashboardAccess>> {
  const [profile, shipper] = await Promise.all([
    supabase
      .from("profiles")
      .select("is_admin, is_shop, shopify_connect_enabled")
      .eq("id", userId)
      .maybeSingle(),
    supabase.from("coastal_shippers").select("id").eq("user_id", userId).maybeSingle(),
  ])
  if (profile.error) return { ok: false, message: profile.error.message }

  const row = profile.data
  const shipperId = shipper.data?.id
  return {
    ok: true,
    rows: {
      isAdmin: row?.is_admin === true,
      isShipper: !shipper.error && typeof shipperId === "string" && shipperId.length > 0,
      hasShopifyAccess: row?.shopify_connect_enabled === true,
      hasSellerProfile: row?.is_shop === true,
    },
  }
}

function usd(value: number | string | null | undefined): number {
  const amount = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(amount)) return 0
  return Math.round(amount * 100) / 100
}

export async function listMobileFollowedSellers(
  supabase: SupabaseClient,
  userId: string,
): Promise<QueryResult<MobileFollowedSellerRow[]>> {
  const { data, error } = await supabase
    .from("seller_follows")
    .select("seller_id")
    .eq("follower_id", userId)
    .limit(100)

  if (error) return { ok: false, message: error.message }
  const ids = [...new Set((data ?? []).map((row) => String((row as { seller_id?: string }).seller_id ?? "")).filter(Boolean))]
  if (ids.length === 0) return { ok: true, rows: [] }

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, seller_slug, display_name, avatar_url, city, is_shop, shop_name, shop_logo_url, shop_verified")
    .in("id", ids)

  if (profileError) return { ok: false, message: profileError.message }
  return { ok: true, rows: (profiles ?? []) as MobileFollowedSellerRow[] }
}

export async function listMobileCartRows(
  supabase: SupabaseClient,
  userId: string,
): Promise<QueryResult<MobileCartRow[]>> {
  const { data, error } = await supabase
    .from("cart_items")
    .select(`quantity, listings (${MOBILE_LISTING_SELECT})`)
    .eq("profile_id", userId)
    .order("created_at", { ascending: false })

  if (error) return { ok: false, message: error.message }
  const rows = (data ?? []).map((row) => {
    const raw = row as { quantity?: number | null; listings: MobileListingRow | MobileListingRow[] | null }
    return { quantity: raw.quantity ?? 1, listing: one(raw.listings) }
  })
  return { ok: true, rows }
}

export type MobileSaleDetailRow = MobileOrderRow & {
  buyer_id: string
  shipping_amount: number | string | null
  platform_fee: number | string | null
  promo_discount_usd: number | string | null
  tracking_carrier: string | null
  ship_to: string | null
  listing_slug: string | null
  payout_status: string | null
}

function shipToLabel(value: unknown): string | null {
  if (!value || typeof value !== "object") return null
  const address = value as {
    name?: string | null
    address?: {
      line1?: string | null
      line2?: string | null
      city?: string | null
      state?: string | null
      postal_code?: string | null
    } | null
  }
  const line = address.address
  const parts = [address.name, line?.line1, line?.line2, [line?.city, line?.state, line?.postal_code].filter(Boolean).join(", ")]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
  return parts.length > 0 ? parts.join("\n") : null
}

/** One marketplace sale owned by this seller. */
export async function getMobileSaleDetailRow(
  supabase: SupabaseClient,
  userId: string,
  orderId: string,
): Promise<QueryResult<MobileSaleDetailRow | null>> {
  const { data, error } = await supabase
    .from("orders")
    .select(
      `
      id,
      order_num,
      amount,
      shipping_amount,
      platform_fee,
      seller_earnings,
      promo_discount_usd,
      status,
      delivery_status,
      tracking_number,
      tracking_carrier,
      created_at,
      fulfillment_method,
      shipping_address,
      buyer_id,
      listings ( id, slug, title, listing_images (url, thumbnail_url, is_primary, sort_order) )
    `,
    )
    .eq("id", orderId)
    .eq("seller_id", userId)
    .match(REAL_MARKETPLACE_PURCHASES_FILTER)
    .in("status", [...ORDER_STATUS_LIST])
    .maybeSingle()

  if (error) return { ok: false, message: error.message }
  if (!data) return { ok: true, rows: null }

  const raw = data as Record<string, unknown>
  const listing = one(
    raw.listings as (MobileOrderRow["listing"] & { slug?: string | null }) | Array<MobileOrderRow["listing"] & { slug?: string | null }> | null,
  )
  const buyerId = String(raw.buyer_id ?? "")
  const [buyer, payout] = await Promise.all([
    buyerId
      ? supabase.from("profiles").select("display_name").eq("id", buyerId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from("payouts").select("status").eq("order_id", orderId).maybeSingle(),
  ])
  if (buyer.error) return { ok: false, message: buyer.error.message }

  const listingSlug = listing && "slug" in listing && typeof listing.slug === "string" ? listing.slug : null
  return {
    ok: true,
    rows: {
      id: String(raw.id),
      order_num: typeof raw.order_num === "string" ? raw.order_num : null,
      amount: raw.amount as number | string | null,
      seller_earnings: raw.seller_earnings as number | string | null,
      status: String(raw.status ?? ""),
      delivery_status: typeof raw.delivery_status === "string" ? raw.delivery_status : null,
      tracking_number: typeof raw.tracking_number === "string" ? raw.tracking_number : null,
      created_at: String(raw.created_at ?? ""),
      fulfillment_method: typeof raw.fulfillment_method === "string" ? raw.fulfillment_method : null,
      listing,
      counterparty_name: (buyer.data as { display_name?: string | null } | null)?.display_name ?? null,
      buyer_id: buyerId,
      shipping_amount: raw.shipping_amount as number | string | null,
      platform_fee: raw.platform_fee as number | string | null,
      promo_discount_usd: raw.promo_discount_usd as number | string | null,
      tracking_carrier: typeof raw.tracking_carrier === "string" ? raw.tracking_carrier : null,
      ship_to: shipToLabel(raw.shipping_address),
      listing_slug: listingSlug,
      payout_status: typeof payout.data?.status === "string" ? payout.data.status : null,
    },
  }
}

export async function listMobileOrderRows(
  supabase: SupabaseClient,
  userId: string,
  role: "buyer" | "seller",
): Promise<QueryResult<MobileOrderRow[]>> {
  const ownerColumn = role === "buyer" ? "buyer_id" : "seller_id"
  const otherColumn = role === "buyer" ? "seller_id" : "buyer_id"
  const { data, error } = await supabase
    .from("orders")
    .select(
      `
      id,
      order_num,
      amount,
      seller_earnings,
      status,
      delivery_status,
      tracking_number,
      created_at,
      fulfillment_method,
      ${otherColumn},
      listings ( id, title, listing_images (url, thumbnail_url, is_primary, sort_order) )
    `,
    )
    .eq(ownerColumn, userId)
    .match(REAL_MARKETPLACE_PURCHASES_FILTER)
    .in("status", [...ORDER_STATUS_LIST])
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) return { ok: false, message: error.message }

  const rawRows = (data ?? []) as Array<Record<string, unknown>>
  const otherIds = [...new Set(rawRows.map((row) => String(row[otherColumn] ?? "")).filter(Boolean))]
  const names = new Map<string, string>()
  if (otherIds.length > 0) {
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", otherIds)
    if (profileError) return { ok: false, message: profileError.message }
    for (const profile of profiles ?? []) {
      const row = profile as { id: string; display_name: string | null }
      names.set(row.id, row.display_name ?? "")
    }
  }

  const rows: MobileOrderRow[] = rawRows.map((row) => {
    const listing = one(row.listings as MobileOrderRow["listing"] | NonNullable<MobileOrderRow["listing"]>[] | null)
    return {
      id: String(row.id),
      order_num: typeof row.order_num === "string" ? row.order_num : null,
      amount: row.amount as number | string | null,
      seller_earnings: row.seller_earnings as number | string | null,
      status: String(row.status ?? ""),
      delivery_status: typeof row.delivery_status === "string" ? row.delivery_status : null,
      tracking_number: typeof row.tracking_number === "string" ? row.tracking_number : null,
      created_at: String(row.created_at ?? ""),
      fulfillment_method: typeof row.fulfillment_method === "string" ? row.fulfillment_method : null,
      listing,
      counterparty_name: names.get(String(row[otherColumn] ?? "")) ?? null,
    }
  })
  return { ok: true, rows }
}

export async function listMobileReviewRows(
  sellerId: string,
  limit: number,
  offset: number,
): Promise<QueryResult<MobileReviewRow[]> & { hasMore?: boolean }> {
  const supabase = getDb({ consistency: "eventual", purpose: "catalog" })
  const { data, error } = await supabase
    .from("reviews")
    .select(
      `
      id,
      rating,
      comment,
      created_at,
      reviewer:profiles!reviews_reviewer_id_fkey ( display_name ),
      listing:listings!reviews_listing_id_fkey ( user_id )
    `,
    )
    .eq("reviewed_id", sellerId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit)

  if (error) return { ok: false, message: error.message }

  const rows = (data ?? []).map((row) => {
    const raw = row as {
      id: string
      rating: number | string | null
      comment: string | null
      created_at: string
      reviewer: { display_name?: string | null } | { display_name?: string | null }[] | null
      listing: { user_id?: string | null } | { user_id?: string | null }[] | null
    }
    const reviewer = one(raw.reviewer)
    const listing = one(raw.listing)
    return {
      id: raw.id,
      rating: raw.rating,
      comment: raw.comment,
      created_at: raw.created_at,
      reviewer_name: reviewer?.display_name ?? null,
      listing_seller_id: listing?.user_id ?? null,
    }
  })
  const hasMore = rows.length > limit
  return { ok: true, rows: hasMore ? rows.slice(0, limit) : rows, hasMore }
}

export async function listMobileMessageRows(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<QueryResult<MobileMessageRow[]>> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, content, sender_id, created_at, metadata, offer_id")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) return { ok: false, message: error.message }
  const rows = ((data ?? []) as MobileMessageRow[]).slice().reverse()
  return { ok: true, rows }
}

/** Messages at or after `after`, oldest first. The client drops ids it already shows. */
export async function listMobileMessageRowsAfter(
  supabase: SupabaseClient,
  conversationId: string,
  after: string,
): Promise<QueryResult<MobileMessageRow[]>> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, content, sender_id, created_at, metadata, offer_id")
    .eq("conversation_id", conversationId)
    .gte("created_at", after)
    .order("created_at", { ascending: true })
    .limit(50)

  if (error) return { ok: false, message: error.message }
  return { ok: true, rows: (data ?? []) as MobileMessageRow[] }
}
