import type { SupabaseClient } from "@supabase/supabase-js"
import { normalizeTrackingNumberForCarrier } from "@/lib/shipping/normalize-tracking-number"
import type { ParsedShipEngineAdjustmentRow } from "@/lib/shipengine/adjustment-reports"
import { listingTitleThumbnailSrc } from "@/lib/listing-image-display"

export type ShipEngineLabelAdjustmentRow = {
  id: string
  report_id: string
  transaction_id: string
  adjustment_id: string | null
  shipment_id: string | null
  tracking_number: string | null
  adjustment_type: string | null
  reason_code: string | null
  adjustment_amount_usd: number
  adjustment_at: string | null
  actual_service: string | null
  actual_package: string | null
  actual_weight: number | null
  actual_length: number | null
  actual_width: number | null
  actual_height: number | null
  order_id: string | null
  wallet_transaction_id: string | null
  wallet_debited_at: string | null
  created_at: string
}

export type ShipEngineAdjustmentDebitSummary = {
  processed: number
  charged: number
  alreadyCharged: number
}

export type ShipEngineAdjustmentClaimContext = {
  orderNum: string | null
  itemTitle: string | null
  itemImageUrl: string | null
  sellerName: string | null
  carrier: string | null
  hasOriginalLabel: boolean
}

function num(v: number | string | null | undefined): number | null {
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function mapRow(row: Record<string, unknown>): ShipEngineLabelAdjustmentRow {
  return {
    id: String(row.id),
    report_id: String(row.report_id),
    transaction_id: String(row.transaction_id),
    adjustment_id: typeof row.adjustment_id === "string" ? row.adjustment_id : null,
    shipment_id: typeof row.shipment_id === "string" ? row.shipment_id : null,
    tracking_number: typeof row.tracking_number === "string" ? row.tracking_number : null,
    adjustment_type: typeof row.adjustment_type === "string" ? row.adjustment_type : null,
    reason_code: typeof row.reason_code === "string" ? row.reason_code : null,
    adjustment_amount_usd: num(row.adjustment_amount_usd as number | string | null) ?? 0,
    adjustment_at: typeof row.adjustment_at === "string" ? row.adjustment_at : null,
    actual_service: typeof row.actual_service === "string" ? row.actual_service : null,
    actual_package: typeof row.actual_package === "string" ? row.actual_package : null,
    actual_weight: num(row.actual_weight as number | string | null),
    actual_length: num(row.actual_length as number | string | null),
    actual_width: num(row.actual_width as number | string | null),
    actual_height: num(row.actual_height as number | string | null),
    order_id: typeof row.order_id === "string" ? row.order_id : null,
    wallet_transaction_id:
      typeof row.wallet_transaction_id === "string" ? row.wallet_transaction_id : null,
    wallet_debited_at:
      typeof row.wallet_debited_at === "string" ? row.wallet_debited_at : null,
    created_at: String(row.created_at),
  }
}

export async function dbApplyShipEngineAdjustmentDebits(
  supabase: SupabaseClient,
  limit = 500,
): Promise<{ data: ShipEngineAdjustmentDebitSummary | null; error: Error | null }> {
  const { data, error } = await supabase.rpc("apply_shipengine_label_adjustment_debits", {
    p_limit: limit,
  })
  if (error) return { data: null, error: new Error(error.message) }

  const result =
    data != null && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : null
  if (!result) {
    return { data: null, error: new Error("Invalid wallet debit response") }
  }

  const processed = num(result.processed as number | string | null)
  const charged = num(result.charged as number | string | null)
  const alreadyCharged = num(result.already_charged as number | string | null)
  if (processed == null || charged == null || alreadyCharged == null) {
    return { data: null, error: new Error("Invalid wallet debit summary") }
  }

  return {
    data: { processed, charged, alreadyCharged },
    error: null,
  }
}

export async function dbListIngestedAdjustmentReportIds(
  supabase: SupabaseClient,
): Promise<{ ids: Set<string>; error: Error | null }> {
  const { data, error } = await supabase.from("shipengine_adjustment_reports").select("report_id")
  if (error) return { ids: new Set(), error: new Error(error.message) }
  return {
    ids: new Set((data ?? []).map((row) => String((row as { report_id: string }).report_id))),
    error: null,
  }
}

export async function dbUpsertAdjustmentReport(
  supabase: SupabaseClient,
  input: { reportId: string; reportCreatedAt: string | null; rowCount: number },
): Promise<{ error: Error | null }> {
  const { error } = await supabase.from("shipengine_adjustment_reports").upsert(
    {
      report_id: input.reportId,
      report_created_at: input.reportCreatedAt,
      ingested_at: new Date().toISOString(),
      row_count: input.rowCount,
    },
    { onConflict: "report_id" },
  )
  if (error) return { error: new Error(error.message) }
  return { error: null }
}

export async function dbUpsertLabelAdjustments(
  supabase: SupabaseClient,
  reportId: string,
  rows: Array<ParsedShipEngineAdjustmentRow & { orderId: string | null }>,
): Promise<{ error: Error | null }> {
  if (rows.length === 0) return { error: null }

  const payload = rows.map((row) => ({
    report_id: reportId,
    transaction_id: row.transactionId,
    adjustment_id: row.adjustmentId,
    shipment_id: row.shipmentId,
    tracking_number: row.trackingNumber,
    adjustment_type: row.adjustmentType,
    reason_code: row.reasonCode,
    adjustment_amount_usd: row.adjustmentAmountUsd,
    adjustment_at: row.adjustmentAt,
    actual_service: row.actualService,
    actual_package: row.actualPackage,
    actual_weight: row.actualWeight,
    actual_length: row.actualLength,
    actual_width: row.actualWidth,
    actual_height: row.actualHeight,
    order_id: row.orderId,
  }))

  const chunkSize = 200
  for (let i = 0; i < payload.length; i += chunkSize) {
    const chunk = payload.slice(i, i + chunkSize)
    const { error } = await supabase.from("shipengine_label_adjustments").upsert(chunk, {
      onConflict: "report_id,transaction_id",
    })
    if (error) return { error: new Error(error.message) }
  }
  return { error: null }
}

export async function dbResolveOrderIdsByTrackingNumbers(
  supabase: SupabaseClient,
  trackingNumbers: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const unique = [
    ...new Set(
      trackingNumbers
        .map((tn) => normalizeTrackingNumberForCarrier(tn) || tn.trim())
        .filter(Boolean),
    ),
  ]
  if (unique.length === 0) return out

  const chunkSize = 100
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize)
    const [orders, marketplace, admin] = await Promise.all([
      supabase.from("orders").select("id, tracking_number").in("tracking_number", chunk),
      supabase.from("order_shipping_labels").select("order_id, tracking_number").in("tracking_number", chunk),
      supabase
        .from("order_admin_shipping_labels")
        .select("order_id, tracking_number")
        .in("tracking_number", chunk),
    ])

    const apply = (tracking: string | null | undefined, orderId: string | null | undefined) => {
      if (!tracking || !orderId) return
      const key = normalizeTrackingNumberForCarrier(tracking) || tracking.trim()
      if (key && !out.has(key)) out.set(key, orderId)
    }

    for (const row of orders.data ?? []) {
      const r = row as { id: string; tracking_number: string | null }
      apply(r.tracking_number, r.id)
    }
    for (const row of marketplace.data ?? []) {
      const r = row as { order_id: string; tracking_number: string | null }
      apply(r.tracking_number, r.order_id)
    }
    for (const row of admin.data ?? []) {
      const r = row as { order_id: string; tracking_number: string | null }
      apply(r.tracking_number, r.order_id)
    }
  }

  return out
}

export async function dbListIncreasedLabelAdjustments(
  supabase: SupabaseClient,
  opts: { limit: number; offset: number },
): Promise<{ data: ShipEngineLabelAdjustmentRow[]; total: number; error: Error | null }> {
  const { data, error, count } = await supabase
    .from("shipengine_label_adjustments")
    .select("*", { count: "exact" })
    .gt("adjustment_amount_usd", 0)
    .order("adjustment_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(opts.offset, opts.offset + opts.limit - 1)

  if (error) {
    return { data: [], total: 0, error: new Error(error.message) }
  }
  return {
    data: (data ?? []).map((row) => mapRow(row as Record<string, unknown>)),
    total: count ?? 0,
    error: null,
  }
}

type AdjustmentOrderRow = {
  id: string
  order_num: string | null
  listing_id: string | null
  seller_id: string
  tracking_carrier: string | null
}

type AdjustmentLabelRow = {
  order_id: string
  order_item_id?: string | null
  tracking_number: string | null
  tracking_carrier: string | null
  label_pdf_url: string | null
  label_storage_path: string | null
}

/**
 * Claim-ready order context for an adjustment page. Queries are batched across
 * the current page so the admin table does not create an N+1 per adjustment.
 */
export async function dbGetShipEngineAdjustmentClaimContext(
  supabase: SupabaseClient,
  adjustments: ShipEngineLabelAdjustmentRow[],
): Promise<{ data: Map<string, ShipEngineAdjustmentClaimContext>; error: Error | null }> {
  const result = new Map<string, ShipEngineAdjustmentClaimContext>()
  const orderIds = [
    ...new Set(
      adjustments.map((row) => row.order_id).filter((id): id is string => Boolean(id)),
    ),
  ]
  if (orderIds.length === 0) return { data: result, error: null }

  const [ordersResult, itemsResult, marketplaceLabelsResult, adminLabelsResult] =
    await Promise.all([
      supabase
        .from("orders")
        .select("id, order_num, listing_id, seller_id, tracking_carrier")
        .in("id", orderIds),
      supabase
        .from("order_items")
        .select("id, order_id, listing_id, sort_order")
        .in("order_id", orderIds)
        .order("sort_order", { ascending: true }),
      supabase
        .from("order_shipping_labels")
        .select(
          "order_id, order_item_id, tracking_number, tracking_carrier, label_pdf_url, label_storage_path",
        )
        .in("order_id", orderIds)
        .order("created_at", { ascending: false }),
      supabase
        .from("order_admin_shipping_labels")
        .select(
          "order_id, tracking_number, tracking_carrier, label_pdf_url, label_storage_path",
        )
        .in("order_id", orderIds)
        .order("created_at", { ascending: false }),
    ])

  const failed =
    ordersResult.error ??
    itemsResult.error ??
    marketplaceLabelsResult.error ??
    adminLabelsResult.error
  if (failed) return { data: result, error: new Error(failed.message) }

  const orders = (ordersResult.data ?? []) as AdjustmentOrderRow[]
  const orderById = new Map(orders.map((row) => [row.id, row]))
  const sellerIds = [...new Set(orders.map((row) => row.seller_id).filter(Boolean))]
  const items = (itemsResult.data ?? []) as Array<{
    id: string
    order_id: string
    listing_id: string
  }>
  const itemById = new Map(items.map((row) => [row.id, row]))
  const firstItemByOrder = new Map<string, (typeof items)[number]>()
  for (const item of items) {
    if (!firstItemByOrder.has(item.order_id)) firstItemByOrder.set(item.order_id, item)
  }

  const labels = [
    ...((marketplaceLabelsResult.data ?? []) as AdjustmentLabelRow[]),
    ...((adminLabelsResult.data ?? []) as AdjustmentLabelRow[]),
  ]
  const matchingLabelByAdjustment = new Map<string, AdjustmentLabelRow>()
  const listingIdByAdjustment = new Map<string, string>()
  for (const adjustment of adjustments) {
    if (!adjustment.order_id) continue
    const wantedTracking = normalizeTrackingNumberForCarrier(adjustment.tracking_number ?? "")
    const label = labels.find(
      (candidate) =>
        candidate.order_id === adjustment.order_id &&
        wantedTracking &&
        normalizeTrackingNumberForCarrier(candidate.tracking_number ?? "") === wantedTracking,
    )
    if (label) matchingLabelByAdjustment.set(adjustment.id, label)

    const order = orderById.get(adjustment.order_id)
    const matchedItem = label?.order_item_id ? itemById.get(label.order_item_id) : null
    const listingId =
      matchedItem?.listing_id ??
      firstItemByOrder.get(adjustment.order_id)?.listing_id ??
      order?.listing_id
    if (listingId) listingIdByAdjustment.set(adjustment.id, listingId)
  }

  const listingIds = [...new Set(listingIdByAdjustment.values())]
  const [profilesResult, listingsResult] = await Promise.all([
    sellerIds.length
      ? supabase
          .from("profiles")
          .select("id, display_name, shop_name, is_shop")
          .in("id", sellerIds)
      : Promise.resolve({ data: [], error: null }),
    listingIds.length
      ? supabase
          .from("listings")
          .select("id, title, primary_image_url, primary_thumbnail_url")
          .in("id", listingIds)
      : Promise.resolve({ data: [], error: null }),
  ])
  const relatedError = profilesResult.error ?? listingsResult.error
  if (relatedError) return { data: result, error: new Error(relatedError.message) }

  const profiles = new Map(
    (profilesResult.data ?? []).map((row) => {
      const profile = row as {
        id: string
        display_name: string | null
        shop_name: string | null
        is_shop: boolean | null
      }
      const name =
        (profile.is_shop ? profile.shop_name?.trim() : null) ||
        profile.display_name?.trim() ||
        profile.shop_name?.trim() ||
        null
      return [profile.id, name] as const
    }),
  )
  const listings = new Map(
    (listingsResult.data ?? []).map((row) => {
      const listing = row as {
        id: string
        title: string | null
        primary_image_url: string | null
        primary_thumbnail_url: string | null
      }
      return [listing.id, listing] as const
    }),
  )

  for (const adjustment of adjustments) {
    const order = adjustment.order_id ? orderById.get(adjustment.order_id) : null
    const label = matchingLabelByAdjustment.get(adjustment.id)
    const listingId = listingIdByAdjustment.get(adjustment.id)
    const listing = listingId ? listings.get(listingId) : null
    const imageUrl = listing
      ? listingTitleThumbnailSrc([
          {
            url: listing.primary_image_url,
            thumbnail_url: listing.primary_thumbnail_url,
            is_primary: true,
          },
        ])
      : ""
    result.set(adjustment.id, {
      orderNum: order?.order_num ?? null,
      itemTitle: listing?.title?.trim() || null,
      itemImageUrl: imageUrl || null,
      sellerName: order ? profiles.get(order.seller_id) ?? null : null,
      carrier: label?.tracking_carrier?.trim() || order?.tracking_carrier?.trim() || null,
      hasOriginalLabel: Boolean(
        adjustment.order_id &&
          adjustment.tracking_number &&
          (label?.label_pdf_url?.trim() ||
            label?.label_storage_path?.trim() ||
            adjustment.shipment_id),
      ),
    })
  }

  return { data: result, error: null }
}

function addAdjustmentTotal(
  totals: Map<string, number>,
  key: string,
  amount: number | string | null,
): void {
  const value = num(amount)
  if (value == null || value <= 0) return
  totals.set(key, Math.round(((totals.get(key) ?? 0) + value) * 100) / 100)
}

/** Positive ShipEngine adjustment fees summed by Reswell order id. */
export async function dbGetIncreasedAdjustmentTotalsByOrderIds(
  supabase: SupabaseClient,
  orderIds: string[],
): Promise<{ data: Map<string, number>; error: Error | null }> {
  const ids = [...new Set(orderIds.filter(Boolean))]
  const totals = new Map<string, number>()

  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await supabase
      .from("shipengine_label_adjustments")
      .select("order_id, adjustment_amount_usd")
      .in("order_id", ids.slice(i, i + 100))
      .gt("adjustment_amount_usd", 0)

    if (error) return { data: new Map(), error: new Error(error.message) }
    for (const row of data ?? []) {
      const orderId = typeof row.order_id === "string" ? row.order_id : null
      if (orderId) addAdjustmentTotal(totals, orderId, row.adjustment_amount_usd)
    }
  }

  return { data: totals, error: null }
}

/** Positive ShipEngine adjustment fees summed by normalized tracking number. */
export async function dbGetIncreasedAdjustmentTotalsByTrackingNumbers(
  supabase: SupabaseClient,
  trackingNumbers: string[],
): Promise<{ data: Map<string, number>; error: Error | null }> {
  const rawTrackingNumbers = [...new Set(trackingNumbers.map((value) => value.trim()).filter(Boolean))]
  const totals = new Map<string, number>()

  for (let i = 0; i < rawTrackingNumbers.length; i += 100) {
    const { data, error } = await supabase
      .from("shipengine_label_adjustments")
      .select("tracking_number, adjustment_amount_usd")
      .in("tracking_number", rawTrackingNumbers.slice(i, i + 100))
      .gt("adjustment_amount_usd", 0)

    if (error) return { data: new Map(), error: new Error(error.message) }
    for (const row of data ?? []) {
      if (typeof row.tracking_number !== "string") continue
      const key =
        normalizeTrackingNumberForCarrier(row.tracking_number) || row.tracking_number.trim()
      if (key) addAdjustmentTotal(totals, key, row.adjustment_amount_usd)
    }
  }

  return { data: totals, error: null }
}
