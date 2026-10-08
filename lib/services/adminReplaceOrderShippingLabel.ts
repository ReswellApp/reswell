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
import { fetchRatesForSurfboardOrder } from "@/lib/services/orderShippingLabel"
import { purchaseShipEngineLabelForOrderOnce } from "@/lib/services/purchaseShipEngineLabelForOrderOnce"
import { voidShipEngineLabelForOrder } from "@/lib/services/voidShipEngineLabelForOrder"
import {
  PEER_SURFBOARD_CHECKOUT_LISTING_SELECT,
  type PeerListingForShippingQuote,
} from "@/lib/services/peerListingShippingQuote"
import { applyRateQuoteAddressToOrderShippingJson } from "@/lib/shipping/order-shipping-json"
import {
  orderShippingJsonToRateQuoteAddress,
  profileRowToRateQuoteAddress,
  type RateQuoteAddressFields,
} from "@/lib/shipping/rate-address"
import { validateLabelParcelEntry } from "@/lib/shipping/surfboard-label-limits"
import { resolveSellerShipFromAddress } from "@/lib/services/sellerShipFromAddress"
import { prepareSantaBarbaraDropoffListingsForLabel } from "@/lib/services/santaBarbaraDropoffLabelParcel"
import type { SantaBarbaraExactParcelFields } from "@/lib/services/santaBarbaraDropoffLabelParcel"

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

const LISTING_REPLACE_FALLBACK_SELECT = `
  id,
  title,
  section,
  user_id,
  dimensions,
  city,
  state,
  dropoff_location_id,
  shipping_packed_length_in,
  shipping_packed_width_in,
  shipping_packed_height_in,
  shipping_packed_weight_oz,
  shipping_package_tier,
  shipping_package_band
`.trim()

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

async function loadListingForReplace(
  supabase: SupabaseClient,
  listingId: string,
): Promise<
  | { ok: true; listing: Record<string, unknown> }
  | { ok: false; error: string; status: number }
> {
  const full = await supabase
    .from("listings")
    .select(PEER_SURFBOARD_CHECKOUT_LISTING_SELECT)
    .eq("id", listingId)
    .maybeSingle()

  if (full.error) {
    console.error(
      "[adminReplaceOrderShippingLabel] listing select:",
      full.error.code,
      full.error.message,
    )
  } else if (full.data && typeof full.data === "object") {
    return { ok: true, listing: full.data as Record<string, unknown> }
  } else {
    return { ok: false, error: "Listing not found for this order.", status: 400 }
  }

  const fallback = await supabase
    .from("listings")
    .select(LISTING_REPLACE_FALLBACK_SELECT)
    .eq("id", listingId)
    .maybeSingle()
  if (fallback.error) {
    console.error(
      "[adminReplaceOrderShippingLabel] listing fallback:",
      fallback.error.code,
      fallback.error.message,
    )
    return { ok: false, error: "Could not load the listing for this order.", status: 500 }
  }
  if (!fallback.data || typeof fallback.data !== "object") {
    return { ok: false, error: "Listing not found for this order.", status: 400 }
  }
  return { ok: true, listing: fallback.data as Record<string, unknown> }
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
      tracking_carrier
    `,
    )
    .eq("id", orderId)
    .maybeSingle()

  if (error) {
    console.error("[adminReplaceOrderShippingLabel] order load:", error.code, error.message)
    return { ok: false, error: "Could not load this order.", status: 500 }
  }
  if (!order) {
    return { ok: false, error: "Order not found", status: 404 }
  }

  const o = order as unknown as OrderRowForReplace
  const listingId = typeof o.listing_id === "string" ? o.listing_id.trim() : ""
  if (!listingId) {
    return { ok: false, error: "Listing not found for this order.", status: 400 }
  }
  const loadedListing = await loadListingForReplace(supabase, listingId)
  if (!loadedListing.ok) return loadedListing
  const listing = loadedListing.listing
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

export type AdminReplaceShipFromSource = "seller" | "admin" | "dropoff"

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
    fields: profileRowToRateQuoteAddress(ar),
  }
}

export type AdminReplaceLabelAddress = RateQuoteAddressFields

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

  // Recover ship-from from past orders where this seller was the buyer.
  const recovered = await resolveSellerShipFromAddress(params.supabase, params.sellerId)
  if (recovered.ok) {
    return { ok: true, address: recovered.address, source: "seller" }
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
        /** Current order destination, when it is complete enough to prefill the form. */
        shipTo: AdminReplaceLabelAddress | null
        /** Notes that do not block quoting — the admin can type a corrected address. */
        warnings: string[]
        /** Santa Barbara drop-off carton for this board, when a location box rule matches. */
        suggestedParcel: SantaBarbaraExactParcelFields | null
        /** Active ship-from list: drop-off, seller, or admin. */
        shipFromSource: AdminReplaceShipFromSource
        shipFromAddresses: Array<{
          id: string
          label: string
          oneLine: string
          isDefault: boolean
          fields: AdminReplaceLabelAddress
        }>
      }
    }
  | { ok: false; error: string; status: number }
> {
  const loaded = await loadOrderForReplace(params.supabase, params.orderId)
  if (!loaded.ok) return loaded

  const { order, listing } = loaded
  const reasons: string[] = []
  const warnings: string[] = []
  if (!isShipEngineConfigured()) {
    reasons.push("ShipEngine is not configured.")
  }

  const sellerRows = await loadProfileAddresses(params.supabase, order.seller_id)
  let effectiveSellerRows = sellerRows
  if (effectiveSellerRows.length === 0) {
    const recovered = await resolveSellerShipFromAddress(params.supabase, order.seller_id)
    if (recovered.ok) {
      effectiveSellerRows = [recovered.address]
    }
  }
  const adminRows = await loadProfileAddresses(params.supabase, params.adminUserId)
  const dropoffPlan = await prepareSantaBarbaraDropoffListingsForLabel({
    supabase: params.supabase,
    sellerId: order.seller_id,
    listings: [listing as PeerListingForShippingQuote],
  })
  let shipFromSource: AdminReplaceShipFromSource =
    effectiveSellerRows.length > 0 ? "seller" : "admin"
  let shipFromAddresses = (shipFromSource === "seller" ? effectiveSellerRows : adminRows).map(
    toShipFromOption,
  )
  let suggestedParcel: SantaBarbaraExactParcelFields | null = null
  if (dropoffPlan.applies && dropoffPlan.ok) {
    suggestedParcel = dropoffPlan.parcel
    const dropoffOption = {
      ...toShipFromOption(dropoffPlan.shipFrom),
      label: "Santa Barbara drop-off",
      isDefault: true,
    }
    shipFromSource = "dropoff"
    shipFromAddresses = [
      dropoffOption,
      ...shipFromAddresses.map((address) => ({ ...address, isDefault: false })),
    ]
  } else if (dropoffPlan.applies) {
    warnings.push(dropoffPlan.error)
  }

  if (shipFromAddresses.length === 0) {
    warnings.push("No saved ship-from address. Enter the origin below before getting rates.")
  }

  const shipTo = orderShippingJsonToRateQuoteAddress(order.shipping_address)
  if (!shipTo) {
    warnings.push("Buyer shipping address on this order is incomplete. Enter the ship-to below.")
  }
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
      shipTo,
      warnings,
      suggestedParcel,
      shipFromSource,
      shipFromAddresses,
    },
  }
}

async function resolveAdminReplaceLane(params: {
  supabase: SupabaseClient
  order: OrderRowForReplace
  adminUserId: string
  shipFromAddressId?: string | null
  shipFrom?: AdminReplaceLabelAddress | null
  shipTo?: AdminReplaceLabelAddress | null
  /** Used when the typed origin is the drop-off, not a saved profile address. */
  unmatchedExplicitSource?: AdminReplaceShipFromSource
}): Promise<
  | {
      ok: true
      from: RateQuoteAddressFields
      to: RateQuoteAddressFields
      shipFromSource: AdminReplaceShipFromSource
    }
  | { ok: false; error: string; status: number }
> {
  let from: RateQuoteAddressFields
  let shipFromSource: AdminReplaceShipFromSource = "seller"

  if (params.shipFrom) {
    from = params.shipFrom
    if (params.shipFromAddressId?.trim()) {
      const labeled = await resolveShipFromAddressForAdminReplace({
        supabase: params.supabase,
        sellerId: params.order.seller_id,
        adminUserId: params.adminUserId,
        shipFromAddressId: params.shipFromAddressId,
      })
      if (labeled.ok) shipFromSource = labeled.source
      else if (params.unmatchedExplicitSource) shipFromSource = params.unmatchedExplicitSource
    } else if (params.unmatchedExplicitSource) {
      shipFromSource = params.unmatchedExplicitSource
    }
  } else {
    const shipFromRes = await resolveShipFromAddressForAdminReplace({
      supabase: params.supabase,
      sellerId: params.order.seller_id,
      adminUserId: params.adminUserId,
      shipFromAddressId: params.shipFromAddressId,
    })
    if (!shipFromRes.ok) return shipFromRes
    from = profileRowToRateQuoteAddress(shipFromRes.address)
    shipFromSource = shipFromRes.source
  }

  const to = params.shipTo ?? orderShippingJsonToRateQuoteAddress(params.order.shipping_address)
  if (!to) {
    return {
      ok: false,
      error: "Enter a complete ship-to address (name, street, city, state, and postal code).",
      status: 400,
    }
  }
  if (
    !from.name.trim() ||
    !from.address_line1.trim() ||
    !from.city_locality.trim() ||
    !from.state_province.trim() ||
    !from.postal_code.trim()
  ) {
    return {
      ok: false,
      error: "Enter a complete ship-from address (name, street, city, state, and postal code).",
      status: 400,
    }
  }

  return { ok: true, from, to, shipFromSource }
}

async function saveOrderShipToAddress(
  supabase: SupabaseClient,
  orderId: string,
  existing: unknown,
  shipTo: AdminReplaceLabelAddress,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const shippingAddress = applyRateQuoteAddressToOrderShippingJson(existing, shipTo)
  const { error } = await supabase
    .from("orders")
    .update({
      shipping_address: shippingAddress,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)
  if (error) {
    console.error("[adminReplaceOrderShippingLabel] save ship-to:", error.message)
    return { ok: false, error: "Could not save the updated shipping address." }
  }
  return { ok: true }
}

async function santaBarbaraReplaceLaneHint(params: {
  supabase: SupabaseClient
  sellerId: string
  listing: Record<string, unknown>
}): Promise<{ source?: "dropoff"; shipFrom: RateQuoteAddressFields | null }> {
  const plan = await prepareSantaBarbaraDropoffListingsForLabel({
    supabase: params.supabase,
    sellerId: params.sellerId,
    listings: [params.listing as PeerListingForShippingQuote],
  })
  if (!plan.applies || !plan.ok) return { shipFrom: null }
  return { source: "dropoff", shipFrom: profileRowToRateQuoteAddress(plan.shipFrom) }
}

export async function quoteAdminExactParcelUpsRatesForOrder(params: {
  supabase: SupabaseClient
  orderId: string
  adminUserId: string
  parcel: AdminExactParcel
  shipFromAddressId?: string | null
  shipFrom?: AdminReplaceLabelAddress | null
  shipTo?: AdminReplaceLabelAddress | null
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

  const dropoffLane = await santaBarbaraReplaceLaneHint({
    supabase: params.supabase,
    sellerId: loaded.order.seller_id,
    listing: loaded.listing,
  })
  const resolved = await resolveAdminReplaceLane({
    supabase: params.supabase,
    order: loaded.order,
    adminUserId: params.adminUserId,
    shipFromAddressId: params.shipFromAddressId,
    shipFrom: params.shipFrom ?? dropoffLane.shipFrom,
    shipTo: params.shipTo,
    unmatchedExplicitSource: dropoffLane.source,
  })
  if (!resolved.ok) return resolved

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
        "No UPS rates returned for this box size and address. Check dimensions, weight, and the ship-from and ship-to, then try again.",
      status: 422,
    }
  }

  const from = resolved.from
  const to = resolved.to
  const sourceLabel = resolved.shipFromSource === "admin" ? "Admin ship-from" : "Seller ship-from"
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
      shipFromSource: resolved.shipFromSource,
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
  shipFrom?: AdminReplaceLabelAddress | null
  shipTo?: AdminReplaceLabelAddress | null
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
        shippingAddressSaved: boolean
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

  // Confirm the lane still resolves. Parcel and addresses are baked into rate_id.
  const dropoffLane = await santaBarbaraReplaceLaneHint({
    supabase: params.supabase,
    sellerId: loaded.order.seller_id,
    listing: loaded.listing,
  })
  const resolved = await resolveAdminReplaceLane({
    supabase: params.supabase,
    order: loaded.order,
    adminUserId: params.adminUserId,
    shipFromAddressId: params.shipFromAddressId,
    shipFrom: params.shipFrom ?? dropoffLane.shipFrom,
    shipTo: params.shipTo,
    unmatchedExplicitSource: dropoffLane.source,
  })
  if (!resolved.ok) return resolved

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

  let shippingAddressSaved = true
  if (params.shipTo) {
    const saved = await saveOrderShipToAddress(
      params.supabase,
      loaded.order.id,
      loaded.order.shipping_address,
      params.shipTo,
    )
    shippingAddressSaved = saved.ok
    if (!saved.ok) {
      console.error(
        "[adminReplaceOrderShippingLabel] label purchased but ship-to was not saved",
        loaded.order.id,
        purchased.result.trackingNumber,
        saved.error,
      )
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
      shippingAddressSaved,
    },
  }
}
