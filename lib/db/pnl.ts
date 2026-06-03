import type { SupabaseClient } from "@supabase/supabase-js"

export type PnlStatus = "inventory" | "listed" | "sold"
export type PnlOrderRole = "buyer" | "seller"

export interface PnlEntryRow {
  id: string
  board_name: string
  category: string | null
  status: PnlStatus
  purchase_price: number
  purchase_date: string | null
  sale_price: number | null
  sale_date: string | null
  shipping_cost: number
  platform_fee: number
  other_costs: number
  notes: string | null
  order_id: string | null
  listing_id: string | null
  order_role: PnlOrderRole | null
  order_num: string | null
  listing_slug: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface PnlEntryInsert {
  board_name: string
  category: string | null
  status: PnlStatus
  purchase_price: number
  purchase_date: string | null
  sale_price: number | null
  sale_date: string | null
  shipping_cost: number
  platform_fee: number
  other_costs: number
  notes: string | null
  order_id?: string | null
  listing_id?: string | null
  order_role?: PnlOrderRole | null
  order_num?: string | null
  listing_slug?: string | null
  created_by: string
}

export type PnlEntryUpdate = Partial<Omit<PnlEntryInsert, "created_by">>

/** A Reswell order (admin as buyer or seller) that can be attached to the P&L. */
export interface ReswellOrderOption {
  order_id: string
  order_num: string | null
  role: PnlOrderRole
  board_name: string
  listing_id: string | null
  listing_slug: string | null
  thumbnail_url: string | null
  item_price: number
  shipping_amount: number
  platform_fee: number
  amount: number
  order_date: string
  status: string
  refunded: boolean
}

/** An active (live, unsold) listing the admin owns — attachable as held inventory. */
export interface ReswellListingOption {
  listing_id: string
  listing_slug: string | null
  board_name: string
  category: string | null
  thumbnail_url: string | null
  price: number
  created_at: string
}

const PNL_ENTRY_COLUMNS =
  "id, board_name, category, status, purchase_price, purchase_date, sale_price, sale_date, shipping_cost, platform_fee, other_costs, notes, order_id, listing_id, order_role, order_num, listing_slug, created_by, created_at, updated_at"

const MAX_ENTRIES = 2000
const MAX_ORDER_OPTIONS = 300

export async function listPnlEntries(supabase: SupabaseClient): Promise<PnlEntryRow[]> {
  const { data, error } = await supabase
    .from("pnl_entries")
    .select(PNL_ENTRY_COLUMNS)
    .order("purchase_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(MAX_ENTRIES)

  if (error) throw error
  return (data ?? []) as PnlEntryRow[]
}

export async function insertPnlEntry(
  supabase: SupabaseClient,
  values: PnlEntryInsert,
): Promise<PnlEntryRow> {
  const { data, error } = await supabase
    .from("pnl_entries")
    .insert(values)
    .select(PNL_ENTRY_COLUMNS)
    .single()

  if (error) throw error
  return data as PnlEntryRow
}

export async function updatePnlEntryRow(
  supabase: SupabaseClient,
  id: string,
  values: PnlEntryUpdate,
): Promise<PnlEntryRow> {
  const { data, error } = await supabase
    .from("pnl_entries")
    .update(values)
    .eq("id", id)
    .select(PNL_ENTRY_COLUMNS)
    .single()

  if (error) throw error
  return data as PnlEntryRow
}

export async function deletePnlEntryRow(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("pnl_entries").delete().eq("id", id)
  if (error) throw error
}

/** Order ids already attached to a P&L entry — used to hide them from the picker. */
export async function listAttachedOrderIds(supabase: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("pnl_entries")
    .select("order_id")
    .not("order_id", "is", null)

  if (error) throw error
  const ids = new Set<string>()
  for (const row of (data ?? []) as { order_id: string | null }[]) {
    if (row.order_id) ids.add(row.order_id)
  }
  return ids
}

/** Listing ids already attached to a P&L entry (via an order or as inventory). */
export async function listAttachedListingIds(supabase: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("pnl_entries")
    .select("listing_id")
    .not("listing_id", "is", null)

  if (error) throw error
  const ids = new Set<string>()
  for (const row of (data ?? []) as { listing_id: string | null }[]) {
    if (row.listing_id) ids.add(row.listing_id)
  }
  return ids
}

type RawListingImage = {
  thumbnail_url: string | null
  url: string | null
  is_primary: boolean | null
  sort_order: number | null
}

type RawOrderRow = {
  id: string
  order_num: string | null
  status: string
  amount: number | string | null
  shipping_amount: number | string | null
  platform_fee: number | string | null
  created_at: string
  refunded_at: string | null
  buyer_id: string
  seller_id: string
  listing_id: string | null
}

type RawListingRow = {
  id: string
  title: string | null
  slug: string | null
  listing_images: RawListingImage[] | null
}

function toNum(v: number | string | null | undefined): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function pickThumbnail(images: RawListingImage[] | null | undefined): string | null {
  if (!images || images.length === 0) return null
  const sorted = [...images].sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1
    return (a.sort_order ?? 0) - (b.sort_order ?? 0)
  })
  const best = sorted[0]
  return best?.thumbnail_url ?? best?.url ?? null
}

/**
 * Orders where the given user is the buyer or seller, shaped for the P&L attach
 * picker. RLS already restricts rows to the caller's own orders. Listings are
 * fetched in one batched query (mirrors the admin order pattern, avoids embeds).
 */
export async function listReswellOrdersForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<ReswellOrderOption[]> {
  const { data: orderData, error: orderErr } = await supabase
    .from("orders")
    .select(
      "id, order_num, status, amount, shipping_amount, platform_fee, created_at, refunded_at, buyer_id, seller_id, listing_id",
    )
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(MAX_ORDER_OPTIONS)

  if (orderErr) throw orderErr
  const orders = (orderData ?? []) as RawOrderRow[]

  const listingIds = Array.from(
    new Set(orders.map((o) => o.listing_id).filter((id): id is string => id != null)),
  )

  const listingMap = new Map<string, RawListingRow>()
  if (listingIds.length > 0) {
    const { data: listingData, error: listingErr } = await supabase
      .from("listings")
      .select("id, title, slug, listing_images (thumbnail_url, url, is_primary, sort_order)")
      .in("id", listingIds)
    if (listingErr) throw listingErr
    for (const listing of (listingData ?? []) as RawListingRow[]) {
      listingMap.set(listing.id, listing)
    }
  }

  return orders.map((order) => {
    const listing = order.listing_id ? listingMap.get(order.listing_id) : undefined
    const amount = toNum(order.amount)
    const shipping = toNum(order.shipping_amount)
    const itemPrice = Math.max(0, Math.round((amount - shipping) * 100) / 100)
    const role: PnlOrderRole = order.seller_id === userId ? "seller" : "buyer"
    return {
      order_id: order.id,
      order_num: order.order_num,
      role,
      board_name: listing?.title ?? order.order_num ?? "Reswell board",
      listing_id: order.listing_id,
      listing_slug: listing?.slug ?? null,
      thumbnail_url: pickThumbnail(listing?.listing_images),
      item_price: itemPrice,
      shipping_amount: shipping,
      platform_fee: toNum(order.platform_fee),
      amount,
      order_date: order.created_at,
      status: order.status,
      refunded: order.refunded_at != null,
    }
  })
}

type RawActiveListingRow = {
  id: string
  title: string | null
  slug: string | null
  price: number | string | null
  board_type: string | null
  created_at: string
  listing_images: RawListingImage[] | null
}

/**
 * The admin's own active (live, unsold) listings — attachable as held inventory.
 * RLS lets owners read their listings; active listings are public anyway.
 */
export async function listActiveListingsForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<ReswellListingOption[]> {
  const { data, error } = await supabase
    .from("listings")
    .select("id, title, slug, price, board_type, created_at, listing_images (thumbnail_url, url, is_primary, sort_order)")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(MAX_ORDER_OPTIONS)

  if (error) throw error

  return ((data ?? []) as RawActiveListingRow[]).map((listing) => ({
    listing_id: listing.id,
    listing_slug: listing.slug,
    board_name: listing.title ?? "Reswell listing",
    category: listing.board_type,
    thumbnail_url: pickThumbnail(listing.listing_images),
    price: toNum(listing.price),
    created_at: listing.created_at,
  }))
}
