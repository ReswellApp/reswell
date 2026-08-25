import type { SupabaseClient } from "@supabase/supabase-js"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import { isPeerListingSection } from "@/lib/peer-listing-sections"
import type { ProfileAddressRow } from "@/lib/profile-address"
import { deleteShipEngineLabelPurchaseLockForReplacement } from "@/lib/db/shipEngineLabelPurchaseLocks"
import { isShipEngineConfigured } from "@/lib/shipengine/config"
import {
  getShipEngineRateById,
  type ShipEngineRateOption,
} from "@/lib/shipengine/surfboard-label"
import { attachAdminShippingLabelToOrder } from "@/lib/services/adminOrderShippingLabelNotify"
import {
  fetchRatesForSurfboardOrder,
  resolveAddressesForLabel,
} from "@/lib/services/orderShippingLabel"
import { purchaseShipEngineLabelForOrderOnce } from "@/lib/services/purchaseShipEngineLabelForOrderOnce"
import { voidShipEngineLabelForOrder } from "@/lib/services/voidShipEngineLabelForOrder"
import { PEER_SURFBOARD_CHECKOUT_LISTING_SELECT } from "@/lib/services/peerListingShippingQuote"
import { orderShippingJsonToRateQuoteAddress } from "@/lib/shipping/rate-address"
import { validateLabelParcelEntry } from "@/lib/shipping/surfboard-label-limits"

export type AdminExactParcel = {
  lengthIn: number
  widthIn: number
  heightIn: number
  weightLb: number
}

function isUpsRate(rate: Pick<ShipEngineRateOption, "carrierLabel" | "serviceName">): boolean {
  const blob = `${rate.carrierLabel} ${rate.serviceName}`.toLowerCase()
  return blob.includes("ups")
}

function filterUpsRates(rates: ShipEngineRateOption[]): ShipEngineRateOption[] {
  return rates.filter(isUpsRate)
}

type OrderRowForReplace = {
  id: string
  order_num: string | null
  buyer_id: string
  seller_id: string
  listing_id: string
  status: string
  fulfillment_method: string | null
  delivery_status: string
  shipping_address: unknown
  tracking_number: string | null
  tracking_carrier: string | null
  listings: Record<string, unknown> | Record<string, unknown>[] | null
}

async function loadOrderForReplace(
  supabase: SupabaseClient,
  orderId: string,
): Promise<
  | { ok: true; order: OrderRowForReplace; listing: Record<string, unknown> }
  | { ok: false; error: string; status: number }
> {
  const { data: order, error } = await supabase
    .from("orders")
    .select(
      `
      id,
      order_num,
      buyer_id,
      seller_id,
      listing_id,
      status,
      fulfillment_method,
      delivery_status,
      shipping_address,
      tracking_number,
      tracking_carrier,
      listings (
        ${PEER_SURFBOARD_CHECKOUT_LISTING_SELECT}
      )
    `,
    )
    .eq("id", orderId)
    .maybeSingle()

  if (error || !order) {
    return { ok: false, error: "Order not found", status: 404 }
  }

  const o = order as unknown as OrderRowForReplace
  const listing = Array.isArray(o.listings) ? o.listings[0] : o.listings
  if (!listing || typeof listing !== "object") {
    return { ok: false, error: "Listing not found for this order.", status: 400 }
  }
  if (!isPeerListingSection((listing as { section?: string }).section)) {
    return {
      ok: false,
      error: "Exact-parcel label replace is only for marketplace peer listings.",
      status: 400,
    }
  }
  if (o.fulfillment_method !== "shipping") {
    return { ok: false, error: "This order is not a shipping order.", status: 400 }
  }
  if (o.status === "refunded" || o.status === "cancelled") {
    return { ok: false, error: "Cannot buy a label for a refunded or cancelled order.", status: 409 }
  }
  if (o.delivery_status === "delivered" || o.delivery_status === "picked_up") {
    return {
      ok: false,
      error: "This order is already delivered — cannot replace the shipping label.",
      status: 409,
    }
  }

  return { ok: true, order: o, listing: listing as Record<string, unknown> }
}

export type AdminReplaceShipFromSource = "seller" | "admin"

function addressOneLine(ar: ProfileAddressRow): string {
  return [ar.line1, [ar.city, ar.state, ar.postal_code].filter(Boolean).join(", ")]
    .filter(Boolean)
    .join(" · ")
}

function toShipFromOption(ar: ProfileAddressRow) {
  return {
    id: ar.id,
    label: ar.label?.trim() || "Address",
    oneLine: addressOneLine(ar),
    isDefault: ar.is_default,
  }
}

async function loadProfileAddresses(
  supabase: SupabaseClient,
  profileId: string,
): Promise<ProfileAddressRow[]> {
  const { data } = await supabase
    .from("addresses")
    .select("*")
    .eq("profile_id", profileId)
    .order("is_default", { ascending: false })
  return (data ?? []) as ProfileAddressRow[]
}

/**
 * Prefer seller ship-from. If the seller has none, use the logged-in admin’s
 * profile address (exact-box ops often ships from Reswell / admin).
 */
async function resolveShipFromAddressForAdminReplace(params: {
  supabase: SupabaseClient
  sellerId: string
  adminUserId: string
  shipFromAddressId?: string | null
}): Promise<
  | { ok: true; address: ProfileAddressRow; source: AdminReplaceShipFromSource }
  | { ok: false; error: string; status: number }
> {
  const sellerRows = await loadProfileAddresses(params.supabase, params.sellerId)
  const adminRows = await loadProfileAddresses(params.supabase, params.adminUserId)

  if (params.shipFromAddressId?.trim()) {
    const id = params.shipFromAddressId.trim()
    const fromSeller = sellerRows.find((r) => r.id === id)
    if (fromSeller) return { ok: true, address: fromSeller, source: "seller" }
    const fromAdmin = adminRows.find((r) => r.id === id)
    if (fromAdmin) return { ok: true, address: fromAdmin, source: "admin" }
    return { ok: false, error: "Ship-from address not found", status: 400 }
  }

  const sellerPreferred = sellerRows.find((r) => r.is_default) ?? sellerRows[0]
  if (sellerPreferred) {
    return { ok: true, address: sellerPreferred, source: "seller" }
  }

  const adminPreferred = adminRows.find((r) => r.is_default) ?? adminRows[0]
  if (adminPreferred) {
    return { ok: true, address: adminPreferred, source: "admin" }
  }

  return {
    ok: false,
    error:
      "No ship-from address available. Add one on the seller’s profile, or save a ship-from address on your admin profile.",
    status: 400,
  }
}

export async function getAdminReplaceOrderShippingLabelOverview(params: {
  supabase: SupabaseClient
  orderId: string
  adminUserId: string
}): Promise<
  | {
      ok: true
      data: {
        eligible: boolean
        ineligibleReasons: string[]
        shipEngineConfigured: boolean
        hasExistingLabel: boolean
        order: {
          id: string
          displayOrderNum: string
          listingTitle: string
          deliveryStatus: string
          trackingNumber: string | null
          trackingCarrier: string | null
        }
        buyerAddressSummary: string | null
        /** Active ship-from list: seller addresses, or admin when seller has none. */
        shipFromSource: AdminReplaceShipFromSource
        shipFromAddresses: Array<{
          id: string
          label: string
          oneLine: string
          isDefault: boolean
        }>
      }
    }
  | { ok: false; error: string; status: number }
> {
  const loaded = await loadOrderForReplace(params.supabase, params.orderId)
  if (!loaded.ok) return loaded

  const { order, listing } = loaded
  const reasons: string[] = []
  if (!isShipEngineConfigured()) {
    reasons.push("ShipEngine is not configured.")
  }
  if (!orderShippingJsonToRateQuoteAddress(order.shipping_address)) {
    reasons.push("Buyer shipping address on this order is incomplete.")
  }

  const sellerRows = await loadProfileAddresses(params.supabase, order.seller_id)
  const adminRows = await loadProfileAddresses(params.supabase, params.adminUserId)
  const shipFromSource: AdminReplaceShipFromSource =
    sellerRows.length > 0 ? "seller" : "admin"
  const shipFromAddresses = (shipFromSource === "seller" ? sellerRows : adminRows).map(
    toShipFromOption,
  )

  if (shipFromAddresses.length === 0) {
    reasons.push(
      "No ship-from address available. Add one on the seller’s profile, or save a ship-from address on your admin profile.",
    )
  }

  const shipTo = orderShippingJsonToRateQuoteAddress(order.shipping_address)
  const buyerAddressSummary = shipTo
    ? [shipTo.address_line1, [shipTo.city_locality, shipTo.state_province, shipTo.postal_code].filter(Boolean).join(", ")]
        .filter(Boolean)
        .join(" · ")
    : null

  const listingTitle =
    typeof listing.title === "string" && listing.title.trim()
      ? listing.title.trim()
      : "Item"

  return {
    ok: true,
    data: {
      eligible: reasons.length === 0,
      ineligibleReasons: reasons,
      shipEngineConfigured: isShipEngineConfigured(),
      hasExistingLabel: Boolean(order.tracking_number?.trim()),
      order: {
        id: order.id,
        displayOrderNum: formatOrderNumForCustomer(order.order_num, order.id),
        listingTitle,
        deliveryStatus: order.delivery_status,
        trackingNumber: order.tracking_number,
        trackingCarrier: order.tracking_carrier,
      },
      buyerAddressSummary,
      shipFromSource,
      shipFromAddresses,
    },
  }
}

export async function quoteAdminExactParcelUpsRatesForOrder(params: {
  supabase: SupabaseClient
  orderId: string
  adminUserId: string
  parcel: AdminExactParcel
  shipFromAddressId?: string | null
}): Promise<
  | {
      ok: true
      data: {
        rates: ShipEngineRateOption[]
        orderDisplayNum: string
        shipFromSummary: string
        shipToSummary: string
        shipFromSource: AdminReplaceShipFromSource
      }
    }
  | { ok: false; error: string; status: number }
> {
  const loaded = await loadOrderForReplace(params.supabase, params.orderId)
  if (!loaded.ok) return loaded
  if (!isShipEngineConfigured()) {
    return { ok: false, error: "ShipEngine is not configured.", status: 503 }
  }

  const shipFromRes = await resolveShipFromAddressForAdminReplace({
    supabase: params.supabase,
    sellerId: loaded.order.seller_id,
    adminUserId: params.adminUserId,
    shipFromAddressId: params.shipFromAddressId,
  })
  if (!shipFromRes.ok) return shipFromRes

  const resolved = resolveAddressesForLabel({
    sellerAddress: shipFromRes.address,
    orderShippingJson: loaded.order.shipping_address,
  })
  if (!resolved.ok) {
    return { ok: false, error: resolved.error, status: 400 }
  }

  const ratesResult = await fetchRatesForSurfboardOrder({
    shipFrom: resolved.from,
    shipTo: resolved.to,
    parcel: params.parcel,
    tierId: null,
    adminCustomCarton: true,
    listingSection:
      typeof loaded.listing.section === "string" ? loaded.listing.section : null,
  })
  if (!ratesResult.ok) {
    return { ok: false, error: ratesResult.error, status: ratesResult.status }
  }

  const upsRates = filterUpsRates(ratesResult.rates)
  if (upsRates.length === 0) {
    return {
      ok: false,
      error:
        "No UPS rates returned for this exact box size and lane. Check dimensions/weight against UPS limits and try again.",
      status: 422,
    }
  }

  const from = resolved.from
  const to = resolved.to
  const sourceLabel = shipFromRes.source === "admin" ? "Admin ship-from" : "Seller ship-from"
  return {
    ok: true,
    data: {
      rates: upsRates,
      orderDisplayNum: formatOrderNumForCustomer(loaded.order.order_num, loaded.order.id),
      shipFromSummary: `${sourceLabel}: ${[from.address_line1, [from.city_locality, from.state_province, from.postal_code].filter(Boolean).join(", ")]
        .filter(Boolean)
        .join(" · ")}`,
      shipToSummary: [to.address_line1, [to.city_locality, to.state_province, to.postal_code].filter(Boolean).join(", ")]
        .filter(Boolean)
        .join(" · "),
      shipFromSource: shipFromRes.source,
    },
  }
}

async function clearOrderTrackingForReplacement(
  supabase: SupabaseClient,
  orderId: string,
): Promise<void> {
  const { error } = await supabase
    .from("orders")
    .update({
      tracking_number: null,
      tracking_carrier: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)
  if (error) {
    console.error("[adminReplaceOrderShippingLabel] clear tracking:", error.message)
  }
}

/**
 * Void prior label (best-effort; proceeds when void is pending approval),
 * buy a new UPS label billed to Reswell, and update the order with the new label.
 */
export async function purchaseAdminExactParcelReplacementLabelForOrder(params: {
  supabase: SupabaseClient
  adminUserId: string
  orderId: string
  parcel: AdminExactParcel
  rateId: string
  shipFromAddressId?: string | null
}): Promise<
  | {
      ok: true
      data: {
        labelUrl: string | null
        trackingNumber: string
        trackingCarrier: string | null
        orderDisplayNum: string
        liveQuoteUsd: number | null
        carrierLabel: string
        serviceName: string
        voidResult: {
          attempted: boolean
          approved: boolean | null
          message: string | null
          error: string | null
        }
      }
    }
  | { ok: false; error: string; status: number }
> {
  const loaded = await loadOrderForReplace(params.supabase, params.orderId)
  if (!loaded.ok) return loaded
  if (!isShipEngineConfigured()) {
    return { ok: false, error: "ShipEngine is not configured.", status: 503 }
  }

  const rateId = params.rateId.trim()
  const rateLookup = await getShipEngineRateById(rateId)
  if (!rateLookup.ok) {
    return { ok: false, error: rateLookup.error, status: rateLookup.status }
  }
  if (!isUpsRate(rateLookup.rate)) {
    return {
      ok: false,
      error: "Selected rate is not a UPS service. Re-quote and pick a UPS rate.",
      status: 400,
    }
  }

  const parcelCheck = validateLabelParcelEntry(params.parcel)
  if (!parcelCheck.ok) {
    return { ok: false, error: parcelCheck.error, status: 400 }
  }

  // Confirm ship-from / ship-to still resolve (parcel dims are baked into rate_id).
  const shipFromRes = await resolveShipFromAddressForAdminReplace({
    supabase: params.supabase,
    sellerId: loaded.order.seller_id,
    adminUserId: params.adminUserId,
    shipFromAddressId: params.shipFromAddressId,
  })
  if (!shipFromRes.ok) return shipFromRes
  const resolved = resolveAddressesForLabel({
    sellerAddress: shipFromRes.address,
    orderShippingJson: loaded.order.shipping_address,
  })
  if (!resolved.ok) {
    return { ok: false, error: resolved.error, status: 400 }
  }

  const hadTracking = Boolean(loaded.order.tracking_number?.trim())
  let voidResult: {
    attempted: boolean
    approved: boolean | null
    message: string | null
    error: string | null
  } = {
    attempted: false,
    approved: null,
    message: null,
    error: null,
  }

  if (hadTracking) {
    voidResult.attempted = true
    const voided = await voidShipEngineLabelForOrder({
      supabase: params.supabase,
      orderId: loaded.order.id,
      explicitLabelId: null,
    })
    if (voided.ok) {
      voidResult.approved = voided.data.approved
      voidResult.message = voided.data.message
    } else {
      voidResult.error = voided.error
      console.warn(
        "[adminReplaceOrderShippingLabel] void failed; continuing with replacement",
        loaded.order.id,
        voided.error,
      )
    }
  }

  // Ensure purchase-once can buy again even if void left tracking or the lock.
  await clearOrderTrackingForReplacement(params.supabase, loaded.order.id)
  const lockCleared = await deleteShipEngineLabelPurchaseLockForReplacement({
    supabase: params.supabase,
    orderId: loaded.order.id,
  })
  if (!lockCleared.ok) {
    return { ok: false, error: lockCleared.error, status: 500 }
  }

  const purchased = await purchaseShipEngineLabelForOrderOnce({
    supabase: params.supabase,
    orderId: loaded.order.id,
    ownerKey: `admin_exact_parcel_replace:${loaded.order.id}:${Date.now()}`,
    rateId,
  })
  if (!purchased.ok) {
    return { ok: false, error: purchased.error, status: purchased.status }
  }

  if (purchased.alreadyPurchased) {
    return {
      ok: false,
      error:
        "Could not buy a replacement label — an existing label is still locked to this order. Try again in a moment, or void the prior label manually.",
      status: 409,
    }
  }

  const listingTitle =
    typeof loaded.listing.title === "string" && loaded.listing.title.trim()
      ? loaded.listing.title.trim()
      : "Item"

  const attached = await attachAdminShippingLabelToOrder({
    supabase: params.supabase,
    adminUserId: params.adminUserId,
    order: {
      id: loaded.order.id,
      buyer_id: loaded.order.buyer_id,
      seller_id: loaded.order.seller_id,
      listing_id: loaded.order.listing_id,
    },
    listingTitle,
    displayOrderNum: formatOrderNumForCustomer(loaded.order.order_num, loaded.order.id),
    source: "shipengine_checkout_lane",
    labelPdfUrl: purchased.result.labelUrl,
    labelStoragePath: null,
    trackingNumber: purchased.result.trackingNumber,
    trackingCarrier: purchased.result.trackingCarrier,
    shipengineRateId: rateId,
    labelCostUsd: purchased.result.costAmount,
    labelCostCurrency: purchased.result.costCurrency,
    paperlessQrUrl: purchased.result.paperlessQrUrl,
    paperlessInstructions: purchased.result.paperlessInstructions,
    paperlessHandoffCode: purchased.result.paperlessHandoffCode,
  })

  if (!attached.ok) {
    return { ok: false, error: attached.error, status: attached.status }
  }

  return {
    ok: true,
    data: {
      labelUrl: purchased.result.labelUrl,
      trackingNumber: purchased.result.trackingNumber,
      trackingCarrier: purchased.result.trackingCarrier,
      orderDisplayNum: formatOrderNumForCustomer(loaded.order.order_num, loaded.order.id),
      liveQuoteUsd: rateLookup.rate.amount,
      carrierLabel: rateLookup.rate.carrierLabel,
      serviceName: rateLookup.rate.serviceName,
      voidResult,
    },
  }
}
