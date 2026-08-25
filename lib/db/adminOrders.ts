import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js"
import { getConversationForBuyerSellerListing } from "@/lib/db/conversations"
import { countOpenOrderShippingLabelFailures } from "@/lib/db/orderShippingLabelFailures"
import { fetchOrderIdsWithPreparedShippingLabels } from "@/lib/db/orderShippingLabels"
import { isReswellShopListing } from "@/lib/reswell-shop"

export type AdminOrderShippingAddress = {
  name?: string | null
  phone?: string | null
  email?: string | null
  admin_terminal?: boolean
  address?: {
    line1?: string | null
    line2?: string | null
    city?: string | null
    state?: string | null
    postal_code?: string | null
    country?: string | null
  } | null
} | null

export type AdminOrderParticipant = {
  id: string
  email: string | null
  display_name: string | null
  avatar_url: string | null
  city: string | null
  state: string | null
  bio: string | null
  created_at: string | null
  sales_count: number | null
  shop_name: string | null
  is_shop: boolean | null
  shop_verified: boolean | null
  seller_slug: string | null
  shop_phone: string | null
  shop_address: string | null
}

export type AdminOrderLineItem = {
  listing_id: string
  title: string | null
  sort_order: number | null
}

export type AdminOrderDetail = {
  id: string
  order_num: string | null
  status: string
  amount: number
  /** Listing price portion of `amount` — the money that flows to the seller (minus platform fee). */
  item_price: number
  /** Buyer-paid shipping included in `amount`. Excluded from platform fee + seller earnings. */
  shipping_amount: number
  platform_fee: number
  seller_earnings: number
  promo_discount_usd: number
  payment_method: string
  fulfillment_method: string | null
  created_at: string
  refunded_at: string | null
  buyer_id: string | null
  seller_id: string
  listing_id: string
  listing_title: string | null
  /** Primary listing section — `new` means Reswell retail shop inventory. */
  listing_section: string | null
  /** True when the primary listing is Reswell shop (`section = new`). */
  is_reswell_shop: boolean
  buyer: AdminOrderParticipant
  seller: AdminOrderParticipant
  shipping_address: AdminOrderShippingAddress
  order_items: AdminOrderLineItem[]
  stripe_checkout_session_id: string | null
  delivery_status: string | null
  tracking_number: string | null
  tracking_carrier: string | null
  carrier_delivered_at: string | null
  /** Listing-scoped buyer↔seller thread for this order, when one exists. */
  conversation_id: string | null
  marketplace_message_count: number
  /** Matching payouts row when present — shipping uses held → pending after carrier delivery + 24h hold. */
  payout: { status: string; hold_reason: string | null; released_at: string | null } | null
  sales_channel: string | null
  /** Six-digit buyer code for local pickup handoff; null for shipping and admin-terminal sales. */
  pickup_code: string | null
}

const ADMIN_ORDER_PARTICIPANT_SELECT =
  "id, email, display_name, avatar_url, city, state, bio, created_at, sales_count, shop_name, is_shop, shop_verified, seller_slug, shop_phone, shop_address"

function num(v: string | number | null | undefined): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function unwrapRelation<T>(raw: T | T[] | null | undefined): T | null {
  if (raw == null) return null
  return Array.isArray(raw) ? raw[0] ?? null : raw
}

function mapGuestBuyerFromShippingAddress(
  ship: AdminOrderShippingAddress,
): AdminOrderParticipant {
  return {
    id: "guest",
    email: ship?.email?.trim() || null,
    display_name: ship?.name?.trim() || "Walk-in customer",
    avatar_url: null,
    city: null,
    state: null,
    bio: null,
    created_at: null,
    sales_count: null,
    shop_name: null,
    is_shop: null,
    shop_verified: null,
    seller_slug: null,
    shop_phone: ship?.phone?.trim() || null,
    shop_address: null,
  }
}

function mapAdminOrderParticipant(
  userId: string,
  row: Record<string, unknown> | null,
): AdminOrderParticipant {
  return {
    id: userId,
    email: typeof row?.email === "string" ? row.email : null,
    display_name: typeof row?.display_name === "string" ? row.display_name : null,
    avatar_url: typeof row?.avatar_url === "string" ? row.avatar_url : null,
    city: typeof row?.city === "string" ? row.city : null,
    state: typeof row?.state === "string" ? row.state : null,
    bio: typeof row?.bio === "string" ? row.bio : null,
    created_at: typeof row?.created_at === "string" ? row.created_at : null,
    sales_count:
      row?.sales_count == null ? null : num(row.sales_count as string | number),
    shop_name: typeof row?.shop_name === "string" ? row.shop_name : null,
    is_shop: typeof row?.is_shop === "boolean" ? row.is_shop : null,
    shop_verified: typeof row?.shop_verified === "boolean" ? row.shop_verified : null,
    seller_slug: typeof row?.seller_slug === "string" ? row.seller_slug : null,
    shop_phone: typeof row?.shop_phone === "string" ? row.shop_phone : null,
    shop_address: typeof row?.shop_address === "string" ? row.shop_address : null,
  }
}

function parseAdminOrderLineItems(raw: unknown): AdminOrderLineItem[] {
  if (!Array.isArray(raw)) return []

  const items: AdminOrderLineItem[] = []
  for (const row of raw) {
    if (!row || typeof row !== "object") continue
    const record = row as Record<string, unknown>
    const listingId =
      typeof record.listing_id === "string"
        ? record.listing_id
        : unwrapRelation(record.listings as { id?: string } | { id?: string }[] | null)?.id
    if (!listingId) continue

    const listing = unwrapRelation(
      record.listings as { title?: string | null } | { title?: string | null }[] | null,
    )
    items.push({
      listing_id: listingId,
      title: typeof listing?.title === "string" ? listing.title : null,
      sort_order: typeof record.sort_order === "number" ? record.sort_order : null,
    })
  }

  return items.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
}

function parseAdminOrderShippingAddress(raw: unknown): AdminOrderShippingAddress {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  return raw as AdminOrderShippingAddress
}

export type AdminOrderStatusCounts = {
  total: number
  confirmed: number
  pending: number
  refunding: number
  refunded: number
}

/** Open-fulfillment stage for confirmed orders that are not yet delivered / picked up. */
export type AdminOpenOrderStage = "awaiting_shipment" | "shipped" | "pickup_ready"

export type AdminOpenOrderAgeBucket = {
  key: "under_1d" | "1_3d" | "3_7d" | "7_14d" | "over_14d"
  label: string
  count: number
}

/**
 * Dashboard KPIs for `/admin/orders`.
 * Payment-status counts include all orders; open-fulfillment metrics exclude admin test seeds
 * (same semantics as the admin overview “Fulfillment” attention tile).
 */
export type AdminOrdersDashboardStats = AdminOrderStatusCounts & {
  /** Confirmed real orders not yet delivered or picked up. */
  openUnfulfilled: number
  openByStage: Record<AdminOpenOrderStage, number>
  openByMethod: { shipping: number; pickup: number }
  openByAge: AdminOpenOrderAgeBucket[]
  /** Confirmed shipping orders still `pending` with no tracking yet. */
  needsLabel: number
  /** Confirmed shipping orders with a label/tracking but not marked shipped. */
  openLabels: number
  /** Automated label-purchase failures still open. */
  openLabelFailures: number
}

export type AdminOrdersOpsParty = {
  display_name: string | null
  email: string | null
}

/** Compact order row for dashboard attention queues. */
export type AdminOrdersOpsOrderRow = {
  id: string
  order_num: string | null
  amount: number
  shipping_amount: number
  fulfillment_method: string | null
  delivery_status: string | null
  tracking_number: string | null
  tracking_carrier: string | null
  listing_title: string | null
  created_at: string
  buyer: AdminOrdersOpsParty | null
  seller: AdminOrdersOpsParty | null
  has_prepared_label: boolean
}

export type AdminOrdersOpsLabelKind = "label_ready" | "label_failed"

/** Open shipping-label attention row (ready to ship or failed automation). */
export type AdminOrdersOpsLabelRow = {
  id: string
  order_num: string | null
  amount: number
  shipping_amount: number
  tracking_number: string | null
  tracking_carrier: string | null
  listing_title: string | null
  created_at: string
  seller: AdminOrdersOpsParty | null
  kind: AdminOrdersOpsLabelKind
  failure_stage: string | null
  failure_message: string | null
  has_prepared_label: boolean
}

export type AdminOrdersDashboardQueues = {
  openOrders: AdminOrdersOpsOrderRow[]
  openLabels: AdminOrdersOpsLabelRow[]
}

export type AdminOpenFulfillmentFilter = "shipping" | "pickup"

export type AdminOrdersOpenLists = {
  shipping: AdminOrdersOpsOrderRow[]
  pickup: AdminOrdersOpsOrderRow[]
}

export type AdminOrdersDashboardPayload = {
  stats: AdminOrdersDashboardStats
  queues: AdminOrdersDashboardQueues
  openLists: AdminOrdersOpenLists
}

const OPEN_LIST_CAP = 200

const OPS_QUEUE_LIMIT = 8

const ORDER_STATUS_KEYS = ["confirmed", "pending", "refunding", "refunded"] as const

const OPEN_AGE_BUCKETS: Array<{
  key: AdminOpenOrderAgeBucket["key"]
  label: string
  /** Inclusive lower bound in days ago (null = no lower bound). */
  minDaysAgo: number | null
  /** Exclusive upper bound in days ago (null = no upper bound / “now”). */
  maxDaysAgo: number | null
}> = [
  { key: "under_1d", label: "< 1 day", minDaysAgo: null, maxDaysAgo: 1 },
  { key: "1_3d", label: "1–3 days", minDaysAgo: 1, maxDaysAgo: 3 },
  { key: "3_7d", label: "3–7 days", minDaysAgo: 3, maxDaysAgo: 7 },
  { key: "7_14d", label: "7–14 days", minDaysAgo: 7, maxDaysAgo: 14 },
  { key: "over_14d", label: "14+ days", minDaysAgo: 14, maxDaysAgo: null },
]

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

/** Confirmed real marketplace orders still in an open delivery stage. */
function openOrdersBase(supabase: SupabaseClient) {
  return supabase
    .from("orders")
    .select("*", { count: "exact", head: true })
    .eq("is_admin_test", false)
    .eq("status", "confirmed")
    .in("delivery_status", ["pending", "shipped", "pickup_ready"])
}

/** Confirmed real shipping orders awaiting first shipment (delivery_status = pending). */
function awaitingShipmentShippingBase(supabase: SupabaseClient) {
  return openOrdersBase(supabase)
    .eq("fulfillment_method", "shipping")
    .eq("delivery_status", "pending")
}

export async function dbListOpenOrdersByMethod(
  supabase: SupabaseClient,
  method: AdminOpenFulfillmentFilter,
): Promise<{ data: AdminOrdersOpsOrderRow[]; error: PostgrestError | null }> {
  let query = supabase
    .from("orders")
    .select(OPS_ORDER_SELECT)
    .eq("is_admin_test", false)
    .eq("status", "confirmed")
    .eq("fulfillment_method", method)
    .order("created_at", { ascending: true })
    .limit(OPEN_LIST_CAP)

  query =
    method === "shipping"
      ? query.in("delivery_status", ["pending", "shipped"])
      : query.neq("delivery_status", "picked_up")

  const { data, error } = await query
  if (error) {
    return { data: [], error }
  }
  return {
    data: await mapOpsOrderRows(supabase, (data ?? []) as OpsOrderRaw[]),
    error: null,
  }
}

type OpsOrderRaw = {
  id: string
  order_num: string | null
  amount: number | string | null
  shipping_amount: number | string | null
  fulfillment_method: string | null
  delivery_status: string | null
  tracking_number: string | null
  tracking_carrier: string | null
  created_at: string
  buyer_id: string | null
  seller_id: string
  listings?:
    | { title: string | null }
    | { title: string | null }[]
    | null
}

function listingTitleFromJoin(
  listings: OpsOrderRaw["listings"],
): string | null {
  const row = Array.isArray(listings) ? listings[0] ?? null : listings
  const title = row?.title?.trim()
  return title || null
}

async function mapOpsOrderRows(
  supabase: SupabaseClient,
  rows: OpsOrderRaw[],
): Promise<AdminOrdersOpsOrderRow[]> {
  if (rows.length === 0) return []

  const orderIds = rows.map((r) => r.id)
  const profileIds = [
    ...new Set(
      rows.flatMap((r) => [r.buyer_id, r.seller_id].filter((id): id is string => Boolean(id))),
    ),
  ]

  const [profilesRes, prepared] = await Promise.all([
    profileIds.length > 0
      ? supabase.from("profiles").select("id, display_name, email").in("id", profileIds)
      : Promise.resolve({ data: [] as Array<{ id: string; display_name: string | null; email: string | null }>, error: null }),
    fetchOrderIdsWithPreparedShippingLabels(supabase, orderIds),
  ])

  const profileMap = new Map<string, AdminOrdersOpsParty>()
  for (const p of profilesRes.data ?? []) {
    profileMap.set(p.id, {
      display_name: p.display_name ?? null,
      email: p.email ?? null,
    })
  }

  return rows.map((r) => ({
    id: r.id,
    order_num: r.order_num,
    amount: num(r.amount),
    shipping_amount: num(r.shipping_amount),
    fulfillment_method: r.fulfillment_method,
    delivery_status: r.delivery_status,
    tracking_number: r.tracking_number,
    tracking_carrier: r.tracking_carrier,
    listing_title: listingTitleFromJoin(r.listings),
    created_at: r.created_at,
    buyer: r.buyer_id ? profileMap.get(r.buyer_id) ?? null : null,
    seller: profileMap.get(r.seller_id) ?? null,
    has_prepared_label: prepared.has(r.id),
  }))
}

const OPS_ORDER_SELECT = `
  id,
  order_num,
  amount,
  shipping_amount,
  fulfillment_method,
  delivery_status,
  tracking_number,
  tracking_carrier,
  created_at,
  buyer_id,
  seller_id,
  listings ( title )
`

/**
 * Count orders per status using cheap `head: true` count queries (no row transfer).
 * Scales to large order tables without loading data.
 */
export async function dbGetAdminOrderStatusCounts(
  supabase: SupabaseClient,
): Promise<{ data: AdminOrderStatusCounts | null; error: PostgrestError | null }> {
  const totalRes = await supabase.from("orders").select("*", { count: "exact", head: true })
  if (totalRes.error) {
    return { data: null, error: totalRes.error }
  }

  const statusResults = await Promise.all(
    ORDER_STATUS_KEYS.map((status) =>
      supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", status),
    ),
  )

  const counts: AdminOrderStatusCounts = {
    total: totalRes.count ?? 0,
    confirmed: 0,
    pending: 0,
    refunding: 0,
    refunded: 0,
  }

  for (let i = 0; i < ORDER_STATUS_KEYS.length; i++) {
    const res = statusResults[i]
    if (res.error) {
      return { data: null, error: res.error }
    }
    counts[ORDER_STATUS_KEYS[i]] = res.count ?? 0
  }

  return { data: counts, error: null }
}

/**
 * Full orders-page dashboard stats: payment KPIs + open (unfulfilled) fulfillment breakdown.
 * Count queries use `head: true` so this stays cheap at scale.
 */
export async function dbGetAdminOrdersDashboardStats(
  supabase: SupabaseClient,
): Promise<{ data: AdminOrdersDashboardStats | null; error: PostgrestError | null }> {
  const statusResult = await dbGetAdminOrderStatusCounts(supabase)
  if (statusResult.error || !statusResult.data) {
    return { data: null, error: statusResult.error }
  }

  const [
    awaitingRes,
    shippedRes,
    pickupReadyRes,
    openShippingRes,
    openPickupRes,
    needsLabelRes,
    openLabelsRes,
    openLabelFailures,
    ...ageResults
  ] = await Promise.all([
    openOrdersBase(supabase).eq("delivery_status", "pending"),
    openOrdersBase(supabase).eq("delivery_status", "shipped"),
    openOrdersBase(supabase).eq("delivery_status", "pickup_ready"),
    openOrdersBase(supabase).eq("fulfillment_method", "shipping"),
    openOrdersBase(supabase).eq("fulfillment_method", "pickup"),
    awaitingShipmentShippingBase(supabase).is("tracking_number", null),
    awaitingShipmentShippingBase(supabase).not("tracking_number", "is", null),
    countOpenOrderShippingLabelFailures(supabase),
    ...OPEN_AGE_BUCKETS.map((bucket) => {
      let q = openOrdersBase(supabase)
      if (bucket.minDaysAgo != null) {
        // Older than minDaysAgo → created_at < now - minDaysAgo
        q = q.lt("created_at", daysAgoIso(bucket.minDaysAgo))
      }
      if (bucket.maxDaysAgo != null) {
        // Newer than maxDaysAgo → created_at >= now - maxDaysAgo
        q = q.gte("created_at", daysAgoIso(bucket.maxDaysAgo))
      }
      return q
    }),
  ])

  const results = [
    awaitingRes,
    shippedRes,
    pickupReadyRes,
    openShippingRes,
    openPickupRes,
    needsLabelRes,
    openLabelsRes,
    ...ageResults,
  ]
  for (const res of results) {
    if (res.error) {
      return { data: null, error: res.error }
    }
  }

  const openByStage: Record<AdminOpenOrderStage, number> = {
    awaiting_shipment: awaitingRes.count ?? 0,
    shipped: shippedRes.count ?? 0,
    pickup_ready: pickupReadyRes.count ?? 0,
  }

  const openByAge: AdminOpenOrderAgeBucket[] = OPEN_AGE_BUCKETS.map((bucket, i) => ({
    key: bucket.key,
    label: bucket.label,
    count: ageResults[i]?.count ?? 0,
  }))

  return {
    data: {
      ...statusResult.data,
      openUnfulfilled:
        openByStage.awaiting_shipment + openByStage.shipped + openByStage.pickup_ready,
      openByStage,
      openByMethod: {
        shipping: openShippingRes.count ?? 0,
        pickup: openPickupRes.count ?? 0,
      },
      openByAge,
      needsLabel: needsLabelRes.count ?? 0,
      openLabels: openLabelsRes.count ?? 0,
      openLabelFailures,
    },
    error: null,
  }
}

/**
 * Attention queues for the orders dashboard: oldest open orders + open shipping labels
 * (label ready / not shipped, and open automation failures). Profiles batched — no N+1.
 */
export async function dbGetAdminOrdersDashboardQueues(
  supabase: SupabaseClient,
): Promise<{ data: AdminOrdersDashboardQueues; error: PostgrestError | null }> {
  const empty: AdminOrdersDashboardQueues = { openOrders: [], openLabels: [] }

  const [openOrdersRes, labelReadyRes, failuresRes] = await Promise.all([
    supabase
      .from("orders")
      .select(OPS_ORDER_SELECT)
      .eq("is_admin_test", false)
      .eq("status", "confirmed")
      .in("delivery_status", ["pending", "shipped", "pickup_ready"])
      .order("created_at", { ascending: true })
      .limit(OPS_QUEUE_LIMIT),
    supabase
      .from("orders")
      .select(OPS_ORDER_SELECT)
      .eq("is_admin_test", false)
      .eq("status", "confirmed")
      .eq("fulfillment_method", "shipping")
      .eq("delivery_status", "pending")
      .not("tracking_number", "is", null)
      .order("created_at", { ascending: true })
      .limit(OPS_QUEUE_LIMIT),
    supabase
      .from("order_shipping_label_failures")
      .select("order_id, failure_stage, error_message, created_at")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(OPS_QUEUE_LIMIT),
  ])

  if (openOrdersRes.error) {
    return { data: empty, error: openOrdersRes.error }
  }
  if (labelReadyRes.error) {
    return { data: empty, error: labelReadyRes.error }
  }
  if (failuresRes.error) {
    return { data: empty, error: failuresRes.error }
  }

  const failureRows = failuresRes.data ?? []
  const failureOrderIds = [...new Set(failureRows.map((f) => f.order_id as string))]
  const openOrderRaws = (openOrdersRes.data ?? []) as OpsOrderRaw[]
  const labelReadyRaws = (labelReadyRes.data ?? []) as OpsOrderRaw[]
  const knownOrderIds = new Set([
    ...openOrderRaws.map((r) => r.id),
    ...labelReadyRaws.map((r) => r.id),
  ])
  const missingFailureIds = failureOrderIds.filter((id) => !knownOrderIds.has(id))

  let failureOrders: OpsOrderRaw[] = []
  if (missingFailureIds.length > 0) {
    const failureOrdersRes = await supabase
      .from("orders")
      .select(OPS_ORDER_SELECT)
      .in("id", missingFailureIds)
    if (failureOrdersRes.error) {
      return { data: empty, error: failureOrdersRes.error }
    }
    failureOrders = (failureOrdersRes.data ?? []) as OpsOrderRaw[]
  }

  const enrichedById = new Map(
    (
      await mapOpsOrderRows(supabase, [
        ...openOrderRaws,
        ...labelReadyRaws,
        ...failureOrders,
      ])
    ).map((row) => [row.id, row]),
  )

  const openOrders = openOrderRaws
    .map((raw) => enrichedById.get(raw.id))
    .filter((row): row is AdminOrdersOpsOrderRow => Boolean(row))

  const seenLabelOrderIds = new Set<string>()
  const openLabels: AdminOrdersOpsLabelRow[] = []

  for (const raw of labelReadyRaws) {
    const row = enrichedById.get(raw.id)
    if (!row) continue
    seenLabelOrderIds.add(row.id)
    openLabels.push({
      id: row.id,
      order_num: row.order_num,
      amount: row.amount,
      shipping_amount: row.shipping_amount,
      tracking_number: row.tracking_number,
      tracking_carrier: row.tracking_carrier,
      listing_title: row.listing_title,
      created_at: row.created_at,
      seller: row.seller,
      kind: "label_ready",
      failure_stage: null,
      failure_message: null,
      has_prepared_label: row.has_prepared_label,
    })
  }

  for (const failure of failureRows) {
    const orderId = failure.order_id as string
    if (seenLabelOrderIds.has(orderId)) continue
    const order = enrichedById.get(orderId)
    if (!order) continue
    seenLabelOrderIds.add(orderId)
    openLabels.push({
      id: order.id,
      order_num: order.order_num,
      amount: order.amount,
      shipping_amount: order.shipping_amount,
      tracking_number: order.tracking_number,
      tracking_carrier: order.tracking_carrier,
      listing_title: order.listing_title,
      created_at: (failure.created_at as string) || order.created_at,
      seller: order.seller,
      kind: "label_failed",
      failure_stage: (failure.failure_stage as string) || null,
      failure_message: (failure.error_message as string) || null,
      has_prepared_label: order.has_prepared_label,
    })
  }

  openLabels.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "label_failed" ? -1 : 1
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })

  return {
    data: {
      openOrders,
      openLabels: openLabels.slice(0, OPS_QUEUE_LIMIT),
    },
    error: null,
  }
}

/** Stats + attention queues for the `/admin/orders` dashboard in one round trip. */
export async function dbGetAdminOrdersDashboard(
  supabase: SupabaseClient,
): Promise<{ data: AdminOrdersDashboardPayload | null; error: PostgrestError | null }> {
  const [statsResult, queuesResult, shippingList, pickupList] = await Promise.all([
    dbGetAdminOrdersDashboardStats(supabase),
    dbGetAdminOrdersDashboardQueues(supabase),
    dbListOpenOrdersByMethod(supabase, "shipping"),
    dbListOpenOrdersByMethod(supabase, "pickup"),
  ])

  if (statsResult.error || !statsResult.data) {
    return { data: null, error: statsResult.error }
  }
  if (queuesResult.error) {
    return { data: null, error: queuesResult.error }
  }
  if (shippingList.error) {
    return { data: null, error: shippingList.error }
  }
  if (pickupList.error) {
    return { data: null, error: pickupList.error }
  }

  return {
    data: {
      stats: statsResult.data,
      queues: queuesResult.data,
      openLists: {
        shipping: shippingList.data,
        pickup: pickupList.data,
      },
    },
    error: null,
  }
}

/** PostgREST rejects the whole row if the select lists a column missing from cache/DB (PGRST204). */
export function isPostgrestSchemaStaleError(err: Pick<PostgrestError, "code" | "message">): boolean {
  const msg = err.message ?? ""
  return (
    err.code === "PGRST204" ||
    msg.includes("shipping_amount") ||
    msg.includes("schema cache") ||
    msg.includes("Could not find the ") ||
    msg.includes("Could not find column") ||
    msg.includes("released_at") ||
    msg.includes("carrier_delivered_at")
  )
}

/**
 * Load a single order with listing title and buyer/seller profile labels (service role).
 */
export async function getOrderDetailForAdmin(
  supabase: SupabaseClient,
  orderId: string,
): Promise<{ data: AdminOrderDetail | null; error: PostgrestError | null }> {
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select(
      `
      id,
      order_num,
      status,
      amount,
      shipping_amount,
      platform_fee,
      seller_earnings,
      promo_discount_usd,
      payment_method,
      fulfillment_method,
      delivery_status,
      tracking_number,
      tracking_carrier,
      carrier_delivered_at,
      created_at,
      refunded_at,
      buyer_id,
      seller_id,
      listing_id,
      sales_channel,
      pickup_code,
      stripe_checkout_session_id,
      shipping_address,
      order_items (
        sort_order,
        listing_id,
        listings ( title )
      )
    `,
    )
    .eq("id", orderId)
    .maybeSingle()

  if (orderErr) {
    return { data: null, error: orderErr }
  }
  if (!order) {
    return { data: null, error: null }
  }

  const listingId = order.listing_id as string
  const buyerId = (order.buyer_id as string | null) ?? null
  const sellerId = order.seller_id as string
  const salesChannel =
    (order as { sales_channel?: string | null }).sales_channel ?? "online"
  const shippingAddress = parseAdminOrderShippingAddress(
    (order as { shipping_address?: unknown }).shipping_address,
  )
  const isTerminalGuestOrder = !buyerId

  const [listingRes, buyerRes, sellerRes, payoutRes, conversation] = await Promise.all([
    supabase.from("listings").select("title, section").eq("id", listingId).maybeSingle(),
    isTerminalGuestOrder
      ? Promise.resolve({ data: null, error: null })
      : supabase.from("profiles").select(ADMIN_ORDER_PARTICIPANT_SELECT).eq("id", buyerId).maybeSingle(),
    supabase.from("profiles").select(ADMIN_ORDER_PARTICIPANT_SELECT).eq("id", sellerId).maybeSingle(),
    supabase.from("payouts").select("status, hold_reason, released_at").eq("order_id", orderId).maybeSingle(),
    isTerminalGuestOrder
      ? Promise.resolve(null)
      : getConversationForBuyerSellerListing(supabase, buyerId, sellerId, listingId),
  ])

  const conversationId = conversation?.id ?? null
  let marketplaceMessageCount = 0
  if (conversationId) {
    const { count } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("conversation_id", conversationId)
    marketplaceMessageCount = count ?? 0
  }

  const listingRow = listingRes.data as { title?: string; section?: string | null } | null
  const listingTitle =
    listingRow && typeof listingRow.title === "string" ? listingRow.title : null
  const listingSection =
    listingRow && typeof listingRow.section === "string" ? listingRow.section : null
  const isReswellShop = isReswellShopListing(listingSection)

  const buyer = isTerminalGuestOrder
    ? mapGuestBuyerFromShippingAddress(shippingAddress)
    : mapAdminOrderParticipant(buyerId, (buyerRes.data as Record<string, unknown> | null) ?? null)
  const seller = mapAdminOrderParticipant(
    sellerId,
    (sellerRes.data as Record<string, unknown> | null) ?? null,
  )

  const amount = num(order.amount)
  const shippingAmount = num((order as { shipping_amount?: string | number | null }).shipping_amount)
  const promoDiscountUsd = num(
    (order as { promo_discount_usd?: string | number | null }).promo_discount_usd,
  )
  const itemPrice = Math.max(0, Math.round((amount - shippingAmount) * 100) / 100)
  const orderItems = parseAdminOrderLineItems((order as { order_items?: unknown }).order_items)

  const payoutRow = payoutRes.data as {
    status?: string
    hold_reason?: string | null
    released_at?: string | null
  } | null
  const payout =
    payoutRow && typeof payoutRow.status === "string"
      ? {
          status: payoutRow.status,
          hold_reason: payoutRow.hold_reason ?? null,
          released_at:
            typeof payoutRow.released_at === "string" && payoutRow.released_at
              ? payoutRow.released_at
              : null,
        }
      : null

  const ordMeta = order as {
    delivery_status?: string | null
    tracking_number?: string | null
    tracking_carrier?: string | null
    carrier_delivered_at?: string | null
  }

  const pickupCodeRaw = (order as { pickup_code?: string | null }).pickup_code
  const pickupCode =
    typeof pickupCodeRaw === "string" && pickupCodeRaw.trim() ? pickupCodeRaw.trim() : null

  return {
    data: {
      id: order.id as string,
      order_num: (order.order_num as string | null) ?? null,
      status: order.status as string,
      amount,
      item_price: itemPrice,
      shipping_amount: shippingAmount,
      platform_fee: num(order.platform_fee),
      seller_earnings: num(order.seller_earnings),
      promo_discount_usd: promoDiscountUsd,
      payment_method: order.payment_method as string,
      fulfillment_method: (order.fulfillment_method as string | null) ?? null,
      delivery_status: (ordMeta.delivery_status as string | null) ?? null,
      tracking_number: (ordMeta.tracking_number as string | null) ?? null,
      tracking_carrier: (ordMeta.tracking_carrier as string | null) ?? null,
      carrier_delivered_at:
        typeof ordMeta.carrier_delivered_at === "string" && ordMeta.carrier_delivered_at
          ? ordMeta.carrier_delivered_at
          : null,
      payout,
      created_at: order.created_at as string,
      refunded_at: (order.refunded_at as string | null) ?? null,
      buyer_id: buyerId,
      seller_id: sellerId,
      listing_id: listingId,
      listing_title: listingTitle,
      listing_section: listingSection,
      is_reswell_shop: isReswellShop,
      buyer,
      seller,
      shipping_address: shippingAddress,
      order_items: orderItems,
      conversation_id: conversationId,
      marketplace_message_count: marketplaceMessageCount,
      stripe_checkout_session_id: (order.stripe_checkout_session_id as string | null) ?? null,
      sales_channel: salesChannel,
      pickup_code: pickupCode,
    },
    error: null,
  }
}
