import type { ProfileAddressRow } from "@/lib/profile-address"
import type { ListingPackedParcelSource } from "@/lib/reswell-packed-parcel-from-listing"
import {
  buyerProfileAddressToShipTo,
  getCheapestReswellRateForListing,
  type ReswellRateableListing,
} from "@/lib/services/reswellListingShippingRate"

/**
 * Supabase `listings` select fragment for peer surfboard checkout + ShipEngine.
 * Used by shipping quotes, payment intent creation, and order finalization so inputs never drift.
 */
export const PEER_SURFBOARD_CHECKOUT_LISTING_SELECT = `
  id,
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
  length_feet,
  length_inches,
  length_inches_display,
  width,
  width_inches_display,
  thickness,
  thickness_inches_display,
  volume,
  volume_display
`.trim()

export type PeerListingForShippingQuote = ListingPackedParcelSource &
  ReswellRateableListing & {
    board_shipping_cost_mode?: string | null
    shipping_price?: string | number | null
  }

export function effectiveBoardShippingMode(
  listing: PeerListingForShippingQuote,
): "free" | "flat" | "reswell" {
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
export async function quoteReswellPeerShippingUsd(input: {
  listing: PeerListingForShippingQuote
  buyerAddress: ProfileAddressRow
  diagnosticTag?: string
  sellerShipFromName: string
}): Promise<{ ok: true; shippingUsd: number } | { ok: false; error: string }> {
  const shipTo = buyerProfileAddressToShipTo(input.buyerAddress)
  if (!shipTo.ok) {
    return { ok: false, error: shipTo.error }
  }

  const result = await getCheapestReswellRateForListing({
    listing: input.listing,
    shipTo: shipTo.address,
    diagnosticTag: input.diagnosticTag ?? "checkout",
    sellerShipFromName: input.sellerShipFromName,
  })
  if (!result.ok) {
    return result
  }
  return { ok: true, shippingUsd: result.cheapest.totalAmount }
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
}): Promise<
  | { ok: true; itemPrice: number; shippingUsd: number; totalUsd: number; usedReswellQuote: boolean }
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
  const sellerLine = input.sellerShipFromName?.trim() || "Seller"
  const q = await quoteReswellPeerShippingUsd({
    listing: input.listing,
    buyerAddress: input.buyerAddress,
    diagnosticTag: input.diagnosticTag,
    sellerShipFromName: sellerLine,
  })
  if (!q.ok) {
    return q
  }
  return {
    ok: true,
    itemPrice,
    shippingUsd: q.shippingUsd,
    totalUsd: itemPrice + q.shippingUsd,
    usedReswellQuote: true,
  }
}
