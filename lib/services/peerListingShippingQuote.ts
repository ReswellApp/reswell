import { listingAlwaysUsesReswellShipping } from "@/lib/apparel-listing-config"
import type { ProfileAddressRow } from "@/lib/profile-address"
import { resolvePackedParcelFromListing } from "@/lib/reswell-packed-parcel-from-listing"
import type { ListingPackedParcelSource } from "@/lib/reswell-packed-parcel-from-listing"
import {
  buyerProfileAddressToShipTo,
  getCheapestReswellRateForListing,
  getCheapestReswellRateForListings,
  type ReswellRateableListing,
} from "@/lib/services/reswellListingShippingRate"
import {
  peerCheckoutSharedSection,
  type PeerCheckoutShippingRateOption,
} from "@/lib/shipping/peer-checkout-usps-services"

/**
 * Supabase `listings` select fragment for peer surfboard checkout + ShipEngine.
 * Used by shipping quotes, payment intent creation, and order finalization so inputs never drift.
 */
export const PEER_SURFBOARD_CHECKOUT_LISTING_SELECT = `
  id,
  slug,
  user_id,
  title,
  price,
  section,
  shipping_available,
  local_pickup,
  shipping_price,
  board_shipping_cost_mode,
  status,
  latitude,
  longitude,
  city,
  state,
  shipping_packed_length_in,
  shipping_packed_width_in,
  shipping_packed_height_in,
  shipping_packed_weight_oz,
  shipping_package_tier,
  shipping_package_band,
  dimensions
`.trim()

export type PeerListingForShippingQuote = ListingPackedParcelSource &
  ReswellRateableListing & {
    section?: string | null
    board_shipping_cost_mode?: string | null
    shipping_price?: string | number | null
  }

/** Row from `listings` + {@link PEER_SURFBOARD_CHECKOUT_LISTING_SELECT}. Assert after runtime filters — Supabase client typings widen rows. */
export type PeerSurfboardCheckoutListingRow = PeerListingForShippingQuote & {
  id: string
  slug: string | null
  user_id: string
  price: string | number
  title: string | null
  section: string | null
  status: string | null
  local_pickup: boolean | null
  shipping_available: boolean | null
}

export function effectiveBoardShippingMode(
  listing: PeerListingForShippingQuote,
): "free" | "flat" | "reswell" {
  if (listingAlwaysUsesReswellShipping(listing.section)) return "reswell"
  const m = listing.board_shipping_cost_mode?.trim()
  if (m === "free" || m === "flat" || m === "reswell") return m
  const sp = Math.max(0, parseFloat(String(listing.shipping_price ?? 0)) || 0)
  return sp > 0 ? "flat" : "reswell"
}

/**
 * Live ShipEngine quote (USD) for peer surfboard checkout when the listing uses Reswell-calculated shipping.
 *
 * Delegates entirely to {@link getCheapestReswellRateForListing} so checkout, finalize, and the admin
 * diagnostic endpoint share one rate path (same payload, same cheapest selection, same total math).
 */
export type PeerReswellShippingQuote = {
  shippingUsd: number
  rateId: string
  serviceCode: string
  serviceName: string
  availableRates: PeerCheckoutShippingRateOption[]
}

export async function quoteReswellPeerShippingUsd(input: {
  listing: PeerListingForShippingQuote
  buyerAddress: ProfileAddressRow
  diagnosticTag?: string
  sellerShipFromName: string
  selectedRateId?: string | null
  selectedServiceCode?: string | null
}): Promise<{ ok: true; quote: PeerReswellShippingQuote } | { ok: false; error: string }> {
  const shipTo = buyerProfileAddressToShipTo(input.buyerAddress)
  if (!shipTo.ok) {
    return { ok: false, error: shipTo.error }
  }

  const result = await getCheapestReswellRateForListing({
    listing: input.listing,
    shipTo: shipTo.address,
    diagnosticTag: input.diagnosticTag ?? "checkout",
    sellerShipFromName: input.sellerShipFromName,
    section: input.listing.section ?? null,
    selectedRateId: input.selectedRateId,
    selectedServiceCode: input.selectedServiceCode,
  })
  if (!result.ok) {
    return result
  }
  return {
    ok: true,
    quote: {
      shippingUsd: result.cheapest.totalAmount,
      rateId: result.cheapest.rate_id!,
      serviceCode: result.cheapest.serviceCode ?? "",
      serviceName: result.cheapest.serviceName,
      availableRates: result.checkoutRateOptions,
    },
  }
}

/**
 * One-box shipping total (USD) for a same-seller bundle shipped together.
 *
 * Cost policy:
 *   • every listing mode `"free"` → $0
 *   • no `"reswell"` listing (flat/free mix) → sum of the flat shipping prices
 *   • any `"reswell"` listing → single combined-box ShipEngine quote
 *     (2 surfboards: longest + 4″ × 22 × 5 × 22 lb; 3 boards: × 27 × 7; otherwise biggest-DIM carton.
 *     Flat prices are NOT added on top — the whole bundle ships in that one carton)
 */
export async function computePeerBundleShippingUsd(input: {
  listings: PeerListingForShippingQuote[]
  buyerAddress: ProfileAddressRow | null
  diagnosticTag?: string
  sellerShipFromName: string
  selectedRateId?: string | null
  selectedServiceCode?: string | null
}): Promise<
  | { ok: true; shippingUsd: number; usedReswellQuote: boolean; quote?: PeerReswellShippingQuote }
  | { ok: false; error: string }
> {
  if (input.listings.length === 0) {
    return { ok: false, error: "No listings to quote shipping for." }
  }

  const modes = input.listings.map(effectiveBoardShippingMode)

  if (modes.every((m) => m === "free")) {
    return { ok: true, shippingUsd: 0, usedReswellQuote: false }
  }

  if (!modes.includes("reswell")) {
    /** Flat/free — dollar amount from listing (no BoardShipper zone tables). */
    const flatSum = input.listings.reduce((sum, l) => {
      const mode = effectiveBoardShippingMode(l)
      if (mode === "free") return sum
      return sum + Math.max(0, parseFloat(String(l.shipping_price ?? 0)) || 0)
    }, 0)
    return { ok: true, shippingUsd: Math.round(flatSum * 100) / 100, usedReswellQuote: false }
  }

  if (!input.buyerAddress) {
    return { ok: false, error: "Shipping address is required" }
  }

  const shipTo = buyerProfileAddressToShipTo(input.buyerAddress)
  if (!shipTo.ok) {
    return { ok: false, error: shipTo.error }
  }

  const result = await getCheapestReswellRateForListings({
    listings: input.listings,
    shipTo: shipTo.address,
    diagnosticTag: input.diagnosticTag ?? "checkout-bundle",
    sellerShipFromName: input.sellerShipFromName,
    section: peerCheckoutSharedSection(input.listings.map((l) => l.section)),
    selectedRateId: input.selectedRateId,
    selectedServiceCode: input.selectedServiceCode,
  })
  if (!result.ok) {
    return result
  }
  return {
    ok: true,
    shippingUsd: result.cheapest.totalAmount,
    usedReswellQuote: true,
    quote: {
      shippingUsd: result.cheapest.totalAmount,
      rateId: result.cheapest.rate_id!,
      serviceCode: result.cheapest.serviceCode ?? "",
      serviceName: result.cheapest.serviceName,
      availableRates: result.checkoutRateOptions,
    },
  }
}

/**
 * Item + shipping total for surfboard peer checkout (flat/free from DB, Reswell from ShipEngine).
 */
export async function computePeerCheckoutTotalsUsd(input: {
  listing: PeerListingForShippingQuote & { price: string | number }
  fulfillment: "pickup" | "shipping"
  buyerAddress: ProfileAddressRow | null
  diagnosticTag?: string
  /** Printed on carrier labels as ship-from contact; required when Reswell shipping quote is used. */
  sellerShipFromName?: string
  /** When set (from a signed checkout quote token), skips a duplicate ShipEngine call. */
  shippingOverride?: {
    shippingUsd: number
    usedReswellQuote: boolean
    rateId?: string | null
    serviceCode?: string | null
  }
  selectedRateId?: string | null
  selectedServiceCode?: string | null
}): Promise<
  | {
      ok: true
      itemPrice: number
      shippingUsd: number
      totalUsd: number
      usedReswellQuote: boolean
      reswellQuote?: PeerReswellShippingQuote
    }
  | { ok: false; error: string }
> {
  const itemPrice = parseFloat(String(input.listing.price))
  if (!Number.isFinite(itemPrice) || itemPrice < 0) {
    return { ok: false, error: "Invalid listing price" }
  }

  if (input.fulfillment === "pickup") {
    return { ok: true, itemPrice, shippingUsd: 0, totalUsd: itemPrice, usedReswellQuote: false }
  }

  const mode = effectiveBoardShippingMode(input.listing)
  if (mode === "free") {
    return { ok: true, itemPrice, shippingUsd: 0, totalUsd: itemPrice, usedReswellQuote: false }
  }
  if (mode === "flat") {
    const ship = Math.max(0, parseFloat(String(input.listing.shipping_price ?? 0)) || 0)
    return {
      ok: true,
      itemPrice,
      shippingUsd: ship,
      totalUsd: itemPrice + ship,
      usedReswellQuote: false,
    }
  }

  if (!input.buyerAddress) {
    return { ok: false, error: "Shipping address is required" }
  }

  if (input.shippingOverride) {
    const parcelCheck = resolvePackedParcelFromListing(input.listing)
    if (!parcelCheck.ok) {
      return parcelCheck
    }
    const ship = input.shippingOverride.shippingUsd
    const rateId = input.shippingOverride.rateId?.trim() || ""
    return {
      ok: true,
      itemPrice,
      shippingUsd: ship,
      totalUsd: itemPrice + ship,
      usedReswellQuote: input.shippingOverride.usedReswellQuote,
      reswellQuote:
        input.shippingOverride.usedReswellQuote && rateId
          ? {
              shippingUsd: ship,
              rateId,
              serviceCode: input.shippingOverride.serviceCode?.trim() || "",
              serviceName: "",
              availableRates: [],
            }
          : undefined,
    }
  }

  const sellerLine = input.sellerShipFromName?.trim() || "Seller"
  const q = await quoteReswellPeerShippingUsd({
    listing: input.listing,
    buyerAddress: input.buyerAddress,
    diagnosticTag: input.diagnosticTag,
    sellerShipFromName: sellerLine,
    selectedRateId: input.selectedRateId,
    selectedServiceCode: input.selectedServiceCode,
  })
  if (!q.ok) {
    return q
  }
  return {
    ok: true,
    itemPrice,
    shippingUsd: q.quote.shippingUsd,
    totalUsd: itemPrice + q.quote.shippingUsd,
    usedReswellQuote: true,
    reswellQuote: q.quote,
  }
}
