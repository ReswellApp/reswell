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
    .limit(100)

  if (error) return { ok: false, message: error.message }

  const rows = (data ?? []).map((row) => {
    const raw = row as { id: string; created_at: string; listing: MobileListingRow | MobileListingRow[] | null }
    return { id: raw.id, created_at: raw.created_at, listing: one(raw.listing) }
  })
  return { ok: true, rows }
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
    .select("id, content, sender_id, created_at, metadata")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) return { ok: false, message: error.message }
  const rows = ((data ?? []) as MobileMessageRow[]).slice().reverse()
  return { ok: true, rows }
}
