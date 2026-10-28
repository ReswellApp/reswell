import { ORDER_STATUS_LIST } from "@/lib/order-status"
import { REAL_MARKETPLACE_PURCHASES_FILTER } from "@/lib/order-admin-test"
import type { SupabaseClient } from "@supabase/supabase-js"

export type MobilePurchaseListingImage = {
  url: string
  thumbnail_url?: string | null
  is_primary: boolean | null
}

export type MobilePurchaseListing = {
  id: string
  title: string | null
  slug?: string | null
  section?: string | null
  condition?: string | null
  listing_images: MobilePurchaseListingImage[] | null
}

export type MobilePurchaseListRow = {
  id: string
  order_num: string | null
  amount: number | string | null
  shipping_amount: number | string | null
  status: string
  delivery_status: string | null
  tracking_number: string | null
  tracking_detail: unknown
  created_at: string
  shipping_address: unknown
  fulfillment_method: string | null
  seller_id: string
  listing: MobilePurchaseListing | null
  seller_name: string | null
}

export type MobilePurchaseOrderItem = {
  sort_order: number | null
  item_price: number | string | null
  listing: MobilePurchaseListing | null
}

export type MobilePurchaseDetailRow = MobilePurchaseListRow & {
  refunded_at: string | null
  carrier_delivered_at: string | null
  tracking_carrier: string | null
  listing_id: string
  order_items: MobilePurchaseOrderItem[]
  seller_slug: string | null
  seller_avatar_url: string | null
}

type QueryResult<T> = { ok: true; rows: T } | { ok: false; message: string }

const LISTING_SELECT =
  "id, title, slug, section, condition, listing_images ( url, thumbnail_url, is_primary )"

function one<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

function asListing(value: unknown): MobilePurchaseListing | null {
  const listing = one(value as MobilePurchaseListing | MobilePurchaseListing[] | null)
  if (!listing?.id) return null
  return listing
}

export async function listMobilePurchaseRows(
  supabase: SupabaseClient,
  userId: string,
): Promise<QueryResult<MobilePurchaseListRow[]>> {
  const { data, error } = await supabase
    .from("orders")
    .select(
      `
      id,
      order_num,
      amount,
      shipping_amount,
      status,
      delivery_status,
      tracking_number,
      tracking_detail,
      created_at,
      shipping_address,
      fulfillment_method,
      seller_id,
      listings ( ${LISTING_SELECT} )
    `,
    )
    .eq("buyer_id", userId)
    .match(REAL_MARKETPLACE_PURCHASES_FILTER)
    .in("status", [...ORDER_STATUS_LIST])
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) return { ok: false, message: error.message }

  const rawRows = (data ?? []) as Array<Record<string, unknown>>
  const sellerIds = [...new Set(rawRows.map((row) => String(row.seller_id ?? "")).filter(Boolean))]
  const names = new Map<string, string>()
  if (sellerIds.length > 0) {
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", sellerIds)
    if (profileError) return { ok: false, message: profileError.message }
    for (const profile of profiles ?? []) {
      const row = profile as { id: string; display_name: string | null }
      names.set(row.id, row.display_name ?? "")
    }
  }

  const rows: MobilePurchaseListRow[] = rawRows.map((row) => {
    const sellerId = String(row.seller_id ?? "")
    return {
      id: String(row.id),
      order_num: typeof row.order_num === "string" ? row.order_num : null,
      amount: row.amount as number | string | null,
      shipping_amount: row.shipping_amount as number | string | null,
      status: String(row.status ?? ""),
      delivery_status: typeof row.delivery_status === "string" ? row.delivery_status : null,
      tracking_number: typeof row.tracking_number === "string" ? row.tracking_number : null,
      tracking_detail: row.tracking_detail,
      created_at: String(row.created_at ?? ""),
      shipping_address: row.shipping_address,
      fulfillment_method: typeof row.fulfillment_method === "string" ? row.fulfillment_method : null,
      seller_id: sellerId,
      listing: asListing(row.listings),
      seller_name: names.get(sellerId) ?? null,
    }
  })
  return { ok: true, rows }
}

export async function getMobilePurchaseDetailRow(
  supabase: SupabaseClient,
  userId: string,
  orderId: string,
): Promise<QueryResult<MobilePurchaseDetailRow | null>> {
  const { data, error } = await supabase
    .from("orders")
    .select(
      `
      id,
      order_num,
      amount,
      shipping_amount,
      status,
      created_at,
      refunded_at,
      carrier_delivered_at,
      fulfillment_method,
      delivery_status,
      tracking_number,
      tracking_carrier,
      shipping_address,
      seller_id,
      listing_id,
      listings ( ${LISTING_SELECT} ),
      order_items (
        sort_order,
        item_price,
        listings ( ${LISTING_SELECT} )
      )
    `,
    )
    .eq("id", orderId)
    .eq("buyer_id", userId)
    .match(REAL_MARKETPLACE_PURCHASES_FILTER)
    .maybeSingle()

  if (error) return { ok: false, message: error.message }
  if (!data) return { ok: true, rows: null }

  const raw = data as Record<string, unknown>
  const sellerId = String(raw.seller_id ?? "")
  const { data: seller, error: sellerError } = sellerId
    ? await supabase
        .from("profiles")
        .select("display_name, seller_slug, avatar_url")
        .eq("id", sellerId)
        .maybeSingle()
    : { data: null, error: null }
  if (sellerError) return { ok: false, message: sellerError.message }

  const sellerProfile = seller as {
    display_name?: string | null
    seller_slug?: string | null
    avatar_url?: string | null
  } | null

  const orderItemsRaw = Array.isArray(raw.order_items) ? raw.order_items : []
  const orderItems: MobilePurchaseOrderItem[] = orderItemsRaw.map((item) => {
    const row = item as Record<string, unknown>
    return {
      sort_order: typeof row.sort_order === "number" ? row.sort_order : null,
      item_price: row.item_price as number | string | null,
      listing: asListing(row.listings),
    }
  })

  return {
    ok: true,
    rows: {
      id: String(raw.id),
      order_num: typeof raw.order_num === "string" ? raw.order_num : null,
      amount: raw.amount as number | string | null,
      shipping_amount: raw.shipping_amount as number | string | null,
      status: String(raw.status ?? ""),
      delivery_status: typeof raw.delivery_status === "string" ? raw.delivery_status : null,
      tracking_number: typeof raw.tracking_number === "string" ? raw.tracking_number : null,
      tracking_detail: null,
      created_at: String(raw.created_at ?? ""),
      shipping_address: raw.shipping_address,
      fulfillment_method: typeof raw.fulfillment_method === "string" ? raw.fulfillment_method : null,
      seller_id: sellerId,
      listing: asListing(raw.listings),
      seller_name: sellerProfile?.display_name ?? null,
      refunded_at: typeof raw.refunded_at === "string" ? raw.refunded_at : null,
      carrier_delivered_at: typeof raw.carrier_delivered_at === "string" ? raw.carrier_delivered_at : null,
      tracking_carrier: typeof raw.tracking_carrier === "string" ? raw.tracking_carrier : null,
      listing_id: String(raw.listing_id ?? ""),
      order_items: orderItems,
      seller_slug: sellerProfile?.seller_slug?.trim() || null,
      seller_avatar_url: sellerProfile?.avatar_url ?? null,
    },
  }
}
