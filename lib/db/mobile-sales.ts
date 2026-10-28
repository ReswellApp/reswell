import { ORDER_STATUS_LIST } from "@/lib/order-status"
import { REAL_MARKETPLACE_SALES_FILTER } from "@/lib/order-admin-test"
import type { SupabaseClient } from "@supabase/supabase-js"

export type MobileSaleListingImage = {
  url: string
  thumbnail_url?: string | null
  is_primary: boolean | null
}

export type MobileSaleListing = {
  id: string
  title: string | null
  slug?: string | null
  section?: string | null
  condition?: string | null
  dropoff_location_id?: string | null
  dropoff_locations?:
    | { slug?: string | null }
    | Array<{ slug?: string | null }>
    | null
  listing_images: MobileSaleListingImage[] | null
}

export type MobileSaleListRow = {
  id: string
  order_num: string | null
  amount: number | string | null
  shipping_amount: number | string | null
  platform_fee: number | string | null
  seller_earnings: number | string | null
  promo_discount_usd: number | string | null
  status: string
  delivery_status: string | null
  tracking_number: string | null
  tracking_detail: unknown
  created_at: string
  shipping_address: unknown
  fulfillment_method: string | null
  buyer_id: string | null
  listing: MobileSaleListing | null
  order_item_listings: MobileSaleListing[]
  buyer_name: string | null
}

export type MobileSaleOrderItem = {
  sort_order: number | null
  item_price: number | string | null
  listing: MobileSaleListing | null
}

export type MobileSaleDetailRow = MobileSaleListRow & {
  refunded_at: string | null
  tracking_carrier: string | null
  listing_id: string
  stripe_checkout_session_id: string | null
  order_items: MobileSaleOrderItem[]
  listing_slug: string | null
  payout_status: string | null
  payout_hold_reason: string | null
}

type QueryResult<T> = { ok: true; rows: T } | { ok: false; message: string }

const LISTING_SELECT =
  "id, title, slug, section, condition, dropoff_location_id, dropoff_locations ( slug ), listing_images ( url, thumbnail_url, is_primary )"

function one<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

function asListing(value: unknown): MobileSaleListing | null {
  const listing = one(value as MobileSaleListing | MobileSaleListing[] | null)
  if (!listing?.id) return null
  return listing
}

export async function listMobileSaleRows(
  supabase: SupabaseClient,
  userId: string,
): Promise<QueryResult<MobileSaleListRow[]>> {
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
      tracking_detail,
      created_at,
      shipping_address,
      fulfillment_method,
      buyer_id,
      listings ( ${LISTING_SELECT} ),
      order_items ( listings ( ${LISTING_SELECT} ) )
    `,
    )
    .eq("seller_id", userId)
    .match(REAL_MARKETPLACE_SALES_FILTER)
    .in("status", [...ORDER_STATUS_LIST])
    .order("created_at", { ascending: false })

  if (error) return { ok: false, message: error.message }

  const rawRows = (data ?? []) as Array<Record<string, unknown>>
  const buyerIds = [
    ...new Set(rawRows.map((row) => String(row.buyer_id ?? "")).filter(Boolean)),
  ]
  const names = new Map<string, string>()
  if (buyerIds.length > 0) {
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", buyerIds)
    if (profileError) return { ok: false, message: profileError.message }
    for (const profile of profiles ?? []) {
      const row = profile as { id: string; display_name: string | null }
      names.set(row.id, row.display_name ?? "")
    }
  }

  const rows: MobileSaleListRow[] = rawRows.map((row) => {
    const buyerId = typeof row.buyer_id === "string" && row.buyer_id.trim() ? row.buyer_id : null
    const orderItemsRaw = Array.isArray(row.order_items) ? row.order_items : []
    const orderItemListings = orderItemsRaw
      .map((item) => asListing((item as { listings?: unknown }).listings))
      .filter((listing): listing is MobileSaleListing => listing != null)
    return {
      id: String(row.id),
      order_num: typeof row.order_num === "string" ? row.order_num : null,
      amount: row.amount as number | string | null,
      shipping_amount: row.shipping_amount as number | string | null,
      platform_fee: row.platform_fee as number | string | null,
      seller_earnings: row.seller_earnings as number | string | null,
      promo_discount_usd: row.promo_discount_usd as number | string | null,
      status: String(row.status ?? ""),
      delivery_status: typeof row.delivery_status === "string" ? row.delivery_status : null,
      tracking_number: typeof row.tracking_number === "string" ? row.tracking_number : null,
      tracking_detail: row.tracking_detail,
      created_at: String(row.created_at ?? ""),
      shipping_address: row.shipping_address,
      fulfillment_method: typeof row.fulfillment_method === "string" ? row.fulfillment_method : null,
      buyer_id: buyerId,
      listing: asListing(row.listings),
      order_item_listings: orderItemListings,
      buyer_name: buyerId ? names.get(buyerId) ?? null : null,
    }
  })
  return { ok: true, rows }
}

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
      created_at,
      refunded_at,
      fulfillment_method,
      delivery_status,
      tracking_number,
      tracking_carrier,
      tracking_detail,
      shipping_address,
      buyer_id,
      listing_id,
      stripe_checkout_session_id,
      listings ( ${LISTING_SELECT} ),
      order_items (
        sort_order,
        item_price,
        listings ( ${LISTING_SELECT} )
      )
    `,
    )
    .eq("id", orderId)
    .eq("seller_id", userId)
    .match(REAL_MARKETPLACE_SALES_FILTER)
    .in("status", [...ORDER_STATUS_LIST])
    .maybeSingle()

  if (error) return { ok: false, message: error.message }
  if (!data) return { ok: true, rows: null }

  const raw = data as Record<string, unknown>
  const buyerId = typeof raw.buyer_id === "string" && raw.buyer_id.trim() ? raw.buyer_id : null
  const [buyer, payout] = await Promise.all([
    buyerId
      ? supabase.from("profiles").select("display_name").eq("id", buyerId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from("payouts").select("status, hold_reason").eq("order_id", orderId).maybeSingle(),
  ])
  if (buyer.error) return { ok: false, message: buyer.error.message }

  const listing = asListing(raw.listings)
  const orderItemsRaw = Array.isArray(raw.order_items) ? raw.order_items : []
  const orderItems: MobileSaleOrderItem[] = orderItemsRaw.map((item) => {
    const row = item as Record<string, unknown>
    return {
      sort_order: typeof row.sort_order === "number" ? row.sort_order : null,
      item_price: row.item_price as number | string | null,
      listing: asListing(row.listings),
    }
  })
  const payoutRow = payout.data as { status?: string | null; hold_reason?: string | null } | null

  return {
    ok: true,
    rows: {
      id: String(raw.id),
      order_num: typeof raw.order_num === "string" ? raw.order_num : null,
      amount: raw.amount as number | string | null,
      shipping_amount: raw.shipping_amount as number | string | null,
      platform_fee: raw.platform_fee as number | string | null,
      seller_earnings: raw.seller_earnings as number | string | null,
      promo_discount_usd: raw.promo_discount_usd as number | string | null,
      status: String(raw.status ?? ""),
      delivery_status: typeof raw.delivery_status === "string" ? raw.delivery_status : null,
      tracking_number: typeof raw.tracking_number === "string" ? raw.tracking_number : null,
      tracking_detail: raw.tracking_detail,
      created_at: String(raw.created_at ?? ""),
      shipping_address: raw.shipping_address,
      fulfillment_method: typeof raw.fulfillment_method === "string" ? raw.fulfillment_method : null,
      buyer_id: buyerId,
      listing,
      order_item_listings: orderItems
        .map((item) => item.listing)
        .filter((item): item is MobileSaleListing => item != null),
      buyer_name: (buyer.data as { display_name?: string | null } | null)?.display_name ?? null,
      refunded_at: typeof raw.refunded_at === "string" ? raw.refunded_at : null,
      tracking_carrier: typeof raw.tracking_carrier === "string" ? raw.tracking_carrier : null,
      listing_id: String(raw.listing_id ?? ""),
      stripe_checkout_session_id:
        typeof raw.stripe_checkout_session_id === "string" ? raw.stripe_checkout_session_id : null,
      order_items: orderItems,
      listing_slug: listing?.slug?.trim() || null,
      payout_status: typeof payoutRow?.status === "string" ? payoutRow.status : null,
      payout_hold_reason: typeof payoutRow?.hold_reason === "string" ? payoutRow.hold_reason : null,
    },
  }
}
