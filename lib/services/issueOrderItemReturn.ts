import type { SupabaseClient } from "@supabase/supabase-js"
import {
  findActiveReturnForOrderItem,
  getOrderItemReturnById,
  insertOrderItemReturn,
  listOrderItemReturnsForOrder,
  type OrderItemReturnRow,
} from "@/lib/db/orderItemReturns"
import {
  listingUsesAdminCustomSurfboardCarton,
  type ListingPackedParcelSource,
} from "@/lib/reswell-packed-parcel-from-listing"
import { PEER_SURFBOARD_CHECKOUT_LISTING_SELECT } from "@/lib/services/peerListingShippingQuote"
import {
  fetchRatesForSurfboardOrder,
  resolveAddressesForReturnLabel,
  resolveOrderLabelParcelFromListing,
  type ShipEngineRateOption,
} from "@/lib/services/orderShippingLabel"
import type { SurfboardShippingTierId } from "@/lib/surfboard-shipping-tiers"
import { attachOrderReturnShippingLabel } from "@/lib/services/attachOrderReturnShippingLabel"
import { purchaseShipEngineLabelForReturnOnce } from "@/lib/services/purchaseShipEngineLabelForReturnOnce"
import {
  downloadAndStoreLabelPdf,
  downloadAndStorePaperlessQr,
} from "@/lib/services/storeOrderShippingLabelAssets"
import { isShipEngineConfigured } from "@/lib/shipengine/config"

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export type ReturnableOrderLine = {
  orderItemId: string | null
  listingId: string
  title: string
  itemPriceUsd: number
  shippingAmountUsd: number
  sellerEarningsUsd: number
  platformFeeUsd: number
  quantity: number
  alreadyReturned: boolean
  activeReturnId: string | null
}

type OrderRowForReturn = {
  id: string
  seller_id: string
  buyer_id: string
  listing_id: string | null
  amount: number | string
  shipping_amount: number | string | null
  platform_fee: number | string | null
  seller_earnings: number | string | null
  status: string
  fulfillment_method: string | null
  shipping_address: unknown
}

export async function listReturnableOrderLines(
  supabase: SupabaseClient,
  orderId: string,
): Promise<{ order: OrderRowForReturn; lines: ReturnableOrderLine[] } | { error: string; status: number }> {
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select(
      "id, seller_id, buyer_id, listing_id, amount, shipping_amount, platform_fee, seller_earnings, status, fulfillment_method, shipping_address",
    )
    .eq("id", orderId)
    .maybeSingle()

  if (orderErr || !order) {
    return { error: "Order not found", status: 404 }
  }

  const orderRow = order as OrderRowForReturn
  const returns = await listOrderItemReturnsForOrder(supabase, orderId)
  const activeByItem = new Map<string, OrderItemReturnRow>()
  const activeByListing = new Map<string, OrderItemReturnRow>()
  for (const r of returns) {
    if (r.status === "cancelled") continue
    if (r.order_item_id) activeByItem.set(r.order_item_id, r)
    activeByListing.set(r.listing_id, r)
  }

  const { data: items } = await supabase
    .from("order_items")
    .select(
      "id, listing_id, sort_order, item_price, shipping_amount, platform_fee, seller_earnings, quantity, listings ( id, title )",
    )
    .eq("order_id", orderId)
    .order("sort_order", { ascending: true })

  const lines: ReturnableOrderLine[] = []

  if (items?.length) {
    for (const raw of items) {
      const row = raw as {
        id: string
        listing_id: string
        item_price: number | string
        shipping_amount: number | string
        platform_fee: number | string
        seller_earnings: number | string
        quantity: number | string | null
        listings: { id: string; title: string | null } | { id: string; title: string | null }[] | null
      }
      const listing = Array.isArray(row.listings) ? row.listings[0] : row.listings
      const active = activeByItem.get(row.id) ?? activeByListing.get(row.listing_id) ?? null
      lines.push({
        orderItemId: row.id,
        listingId: row.listing_id,
        title: listing?.title?.trim() || "Item",
        itemPriceUsd: roundMoney(num(row.item_price)),
        shippingAmountUsd: roundMoney(num(row.shipping_amount)),
        sellerEarningsUsd: roundMoney(num(row.seller_earnings)),
        platformFeeUsd: roundMoney(num(row.platform_fee)),
        quantity: Math.max(1, Math.floor(num(row.quantity) || 1)),
        alreadyReturned: Boolean(active),
        activeReturnId: active?.id ?? null,
      })
    }
  } else if (orderRow.listing_id) {
    const { data: listing } = await supabase
      .from("listings")
      .select("id, title")
      .eq("id", orderRow.listing_id)
      .maybeSingle()
    const active = activeByListing.get(orderRow.listing_id) ?? null
    lines.push({
      orderItemId: null,
      listingId: orderRow.listing_id,
      title: (listing as { title?: string | null } | null)?.title?.trim() || "Item",
      itemPriceUsd: roundMoney(num(orderRow.amount) - num(orderRow.shipping_amount)),
      shippingAmountUsd: roundMoney(num(orderRow.shipping_amount)),
      sellerEarningsUsd: roundMoney(num(orderRow.seller_earnings)),
      platformFeeUsd: roundMoney(num(orderRow.platform_fee)),
      quantity: 1,
      alreadyReturned: Boolean(active),
      activeReturnId: active?.id ?? null,
    })
  }

  return { order: orderRow, lines }
}

async function loadListingForParcel(
  supabase: SupabaseClient,
  listingId: string,
): Promise<ListingPackedParcelSource | null> {
  const { data } = await supabase
    .from("listings")
    .select(PEER_SURFBOARD_CHECKOUT_LISTING_SELECT)
    .eq("id", listingId)
    .maybeSingle()
  return data ? (data as unknown as ListingPackedParcelSource) : null
}

function resolveLine(
  lines: ReturnableOrderLine[],
  params: { orderItemId?: string | null; listingId?: string | null },
): ReturnableOrderLine | null {
  if (params.orderItemId) {
    return lines.find((l) => l.orderItemId === params.orderItemId) ?? null
  }
  if (params.listingId) {
    return lines.find((l) => l.listingId === params.listingId) ?? null
  }
  return null
}

export async function quoteOrderItemReturnRates(params: {
  supabase: SupabaseClient
  orderId: string
  orderItemId?: string | null
  listingId?: string | null
  parcel?: {
    length_in: number
    width_in: number
    height_in: number
    weight_lb: number
  } | null
}): Promise<
  | {
      ok: true
      line: ReturnableOrderLine
      rates: ShipEngineRateOption[]
      shipFromSummary: string
      shipToSummary: string
      refundAmountUsd: number
      sellerClawbackUsd: number
    }
  | { ok: false; error: string; status: number }
> {
  if (!isShipEngineConfigured()) {
    return { ok: false, error: "Label printing is not configured.", status: 503 }
  }

  const listed = await listReturnableOrderLines(params.supabase, params.orderId)
  if ("error" in listed) return { ok: false, error: listed.error, status: listed.status }

  const { order, lines } = listed
  if (order.status !== "confirmed") {
    return { ok: false, error: "Only confirmed orders can start a return.", status: 400 }
  }
  if (order.fulfillment_method !== "shipping") {
    return { ok: false, error: "Returns with prepaid labels require shipping fulfillment.", status: 400 }
  }

  const line = resolveLine(lines, {
    orderItemId: params.orderItemId,
    listingId: params.listingId,
  })
  if (!line) return { ok: false, error: "Order line not found.", status: 404 }
  if (line.alreadyReturned) {
    return { ok: false, error: "This item already has an active return.", status: 409 }
  }

  const addresses = resolveAddressesForReturnLabel({
    orderShippingJson: order.shipping_address,
  })
  if (!addresses.ok) return { ok: false, error: addresses.error, status: 400 }

  let parcel: { lengthIn: number; widthIn: number; heightIn: number; weightLb: number }
  let tierId: SurfboardShippingTierId | null = null
  let adminCustomCarton = false
  let listingSection: string | null = null

  if (params.parcel) {
    parcel = {
      lengthIn: params.parcel.length_in,
      widthIn: params.parcel.width_in,
      heightIn: params.parcel.height_in,
      weightLb: params.parcel.weight_lb,
    }
  } else {
    const listing = await loadListingForParcel(params.supabase, line.listingId)
    if (!listing) return { ok: false, error: "Listing not found for parcel dimensions.", status: 404 }
    listingSection = listing.section ?? null
    const resolved = resolveOrderLabelParcelFromListing(listing)
    if (!resolved.ok) return { ok: false, error: resolved.error, status: 400 }
    parcel = {
      lengthIn: resolved.parcel.lengthIn,
      widthIn: resolved.parcel.widthIn,
      heightIn: resolved.parcel.heightIn,
      weightLb: resolved.parcel.weightLb,
    }
    tierId = resolved.parcel.tierId
    adminCustomCarton = listingUsesAdminCustomSurfboardCarton(listing)
  }

  const ratesResult = await fetchRatesForSurfboardOrder({
    shipFrom: addresses.from,
    shipTo: addresses.to,
    parcel,
    tierId,
    adminCustomCarton,
    listingSection,
  })
  if (!ratesResult.ok) {
    return { ok: false, error: ratesResult.error, status: ratesResult.status }
  }

  const refundAmountUsd = roundMoney(line.itemPriceUsd + line.shippingAmountUsd)
  const sellerClawbackUsd = roundMoney(line.sellerEarningsUsd)

  return {
    ok: true,
    line,
    rates: ratesResult.rates,
    shipFromSummary: [
      addresses.from.name,
      addresses.from.address_line1,
      [addresses.from.city_locality, addresses.from.state_province, addresses.from.postal_code]
        .filter(Boolean)
        .join(", "),
    ]
      .filter(Boolean)
      .join(" · "),
    shipToSummary: [
      addresses.to.name,
      addresses.to.address_line1,
      [addresses.to.city_locality, addresses.to.state_province, addresses.to.postal_code]
        .filter(Boolean)
        .join(", "),
    ]
      .filter(Boolean)
      .join(" · "),
    refundAmountUsd,
    sellerClawbackUsd,
  }
}

async function resolveEligibleReturnLine(params: {
  supabase: SupabaseClient
  orderId: string
  orderItemId?: string | null
  listingId?: string | null
}): Promise<
  | {
      ok: true
      order: OrderRowForReturn
      line: ReturnableOrderLine
      refundAmountUsd: number
      sellerClawbackUsd: number
    }
  | { ok: false; error: string; status: number }
> {
  const listed = await listReturnableOrderLines(params.supabase, params.orderId)
  if ("error" in listed) return { ok: false, error: listed.error, status: listed.status }

  const { order, lines } = listed
  if (order.status !== "confirmed") {
    return { ok: false, error: "Only confirmed orders can start a return.", status: 400 }
  }
  if (order.fulfillment_method !== "shipping") {
    return { ok: false, error: "Returns with prepaid labels require shipping fulfillment.", status: 400 }
  }

  const line = resolveLine(lines, {
    orderItemId: params.orderItemId,
    listingId: params.listingId,
  })
  if (!line) return { ok: false, error: "Order line not found.", status: 404 }
  if (line.alreadyReturned) {
    if (line.activeReturnId) {
      return {
        ok: false,
        error: "This item already has an active return.",
        status: 409,
      }
    }
    return { ok: false, error: "This item already has an active return.", status: 409 }
  }

  return {
    ok: true,
    order,
    line,
    refundAmountUsd: roundMoney(line.itemPriceUsd + line.shippingAmountUsd),
    sellerClawbackUsd: roundMoney(line.sellerEarningsUsd),
  }
}

export async function purchaseOrderItemReturnLabel(params: {
  supabase: SupabaseClient
  orderId: string
  adminProfileId: string
  orderItemId?: string | null
  listingId?: string | null
  rateId: string
}): Promise<
  | { ok: true; returnRow: OrderItemReturnRow; alreadyPurchased: boolean }
  | { ok: false; error: string; status: number }
> {
  if (!isShipEngineConfigured()) {
    return { ok: false, error: "Label printing is not configured.", status: 503 }
  }

  const eligible = await resolveEligibleReturnLine({
    supabase: params.supabase,
    orderId: params.orderId,
    orderItemId: params.orderItemId,
    listingId: params.listingId,
  })

  if (!eligible.ok) {
    if (eligible.status === 409) {
      const listed = await listReturnableOrderLines(params.supabase, params.orderId)
      if (!("error" in listed)) {
        const line = resolveLine(listed.lines, {
          orderItemId: params.orderItemId,
          listingId: params.listingId,
        })
        if (line?.activeReturnId) {
          const existing = await getOrderItemReturnById(params.supabase, line.activeReturnId)
          if (existing) return { ok: true, returnRow: existing, alreadyPurchased: true }
        }
      }
    }
    return eligible
  }

  // Confirm buyer → Reswell still resolves (do not re-quote — rate_id is already chosen).
  const addresses = resolveAddressesForReturnLabel({
    orderShippingJson: eligible.order.shipping_address,
  })
  if (!addresses.ok) return { ok: false, error: addresses.error, status: 400 }

  const dup = await findActiveReturnForOrderItem(params.supabase, {
    orderId: params.orderId,
    orderItemId: eligible.line.orderItemId,
    listingId: eligible.line.listingId,
  })
  if (dup) {
    return { ok: true, returnRow: dup, alreadyPurchased: true }
  }

  const inserted = await insertOrderItemReturn(params.supabase, {
    order_id: params.orderId,
    order_item_id: eligible.line.orderItemId,
    listing_id: eligible.line.listingId,
    created_by: params.adminProfileId,
    item_price_usd: eligible.line.itemPriceUsd,
    shipping_amount_usd: eligible.line.shippingAmountUsd,
    refund_amount_usd: eligible.refundAmountUsd,
    seller_clawback_usd: eligible.sellerClawbackUsd,
    status: "authorized",
  })

  if (inserted.error || !inserted.data) {
    const again = await findActiveReturnForOrderItem(params.supabase, {
      orderId: params.orderId,
      orderItemId: eligible.line.orderItemId,
      listingId: eligible.line.listingId,
    })
    if (again) return { ok: true, returnRow: again, alreadyPurchased: true }
    return {
      ok: false,
      error: inserted.error?.message || "Could not create return",
      status: 500,
    }
  }

  const returnRow = inserted.data
  const purchased = await purchaseShipEngineLabelForReturnOnce({
    supabase: params.supabase,
    returnId: returnRow.id,
    rateId: params.rateId,
    ownerKey: `admin_return:${params.adminProfileId}:${returnRow.id}`,
  })

  if (!purchased.ok) {
    return { ok: false, error: purchased.error, status: purchased.status }
  }

  let labelStoragePath: string | null = null
  let paperlessQrStoragePath: string | null = null

  if (purchased.result.labelUrl?.trim()) {
    const stored = await downloadAndStoreLabelPdf({
      supabase: params.supabase,
      orderId: params.orderId,
      pdfUrl: purchased.result.labelUrl,
    })
    if (stored.ok) labelStoragePath = stored.storagePath
  }

  if (purchased.result.paperlessQrUrl?.trim()) {
    const storedQr = await downloadAndStorePaperlessQr({
      supabase: params.supabase,
      orderId: params.orderId,
      qrUrl: purchased.result.paperlessQrUrl,
    })
    if (storedQr.ok) paperlessQrStoragePath = storedQr.storagePath
  }

  const attached = await attachOrderReturnShippingLabel({
    supabase: params.supabase,
    returnId: returnRow.id,
    labelPdfUrl: purchased.result.labelUrl,
    labelStoragePath,
    trackingNumber: purchased.result.trackingNumber,
    trackingCarrier: purchased.result.trackingCarrier,
    shipengineRateId: params.rateId,
    labelCostUsd: purchased.result.costAmount,
    labelCostCurrency: purchased.result.costCurrency,
    paperlessQrUrl: purchased.result.paperlessQrUrl,
    paperlessQrStoragePath,
    paperlessInstructions: purchased.result.paperlessInstructions,
    paperlessHandoffCode: purchased.result.paperlessHandoffCode,
  })

  if (!attached.ok) {
    return { ok: false, error: attached.error, status: 500 }
  }

  const fresh = await getOrderItemReturnById(params.supabase, returnRow.id)
  if (!fresh) {
    return { ok: false, error: "Return saved but could not be reloaded.", status: 500 }
  }

  return {
    ok: true,
    returnRow: fresh,
    alreadyPurchased: purchased.alreadyPurchased,
  }
}
