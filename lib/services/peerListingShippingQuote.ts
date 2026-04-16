import { reverseGeocodeShipFromParts } from "@/lib/geocoding/nominatim-reverse-us-ship-from"
import type { ProfileAddressRow } from "@/lib/profile-address"
import { resolvePackedParcelFromListing, type ListingPackedParcelSource } from "@/lib/reswell-packed-parcel-from-listing"
import { getTopSurfboardShippingRates, type PublicShippingRateRow } from "@/lib/services/surfboardShippingEstimate"
import type { SurfboardShippingEstimateInput } from "@/lib/validations/surfboard-shipping-estimate"
import { normalizeUsStateProvinceForShipping } from "@/lib/us-state-name-to-code"

export type PeerListingForShippingQuote = ListingPackedParcelSource & {
  latitude?: number | string | null
  longitude?: number | string | null
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

function sellerShipFromFriendly(parts: { address_line1: string; city_locality: string; state_province: string; postal_code: string }) {
  return {
    name: "Seller",
    phone: "",
    company_name: "",
    address_line1: parts.address_line1,
    address_line2: "",
    city_locality: parts.city_locality,
    state_province: parts.state_province,
    postal_code: parts.postal_code.length >= 5 ? parts.postal_code.slice(0, 5) : parts.postal_code,
    country_code: "US" as const,
    residential: "no" as const,
  }
}

function buyerShipTo(addr: ProfileAddressRow): SurfboardShippingEstimateInput["shipTo"] | null {
  const cc = (addr.country ?? "US").trim().toUpperCase()
  if (cc !== "US") {
    return null
  }
  const st = (addr.state ?? "").trim()
  if (!st) return null
  const zip = addr.postal_code.trim()
  if (!/^\d{5}(-\d{4})?$/.test(zip)) {
    return null
  }
  return {
    name: addr.full_name.trim() || "Buyer",
    phone: (addr.phone ?? "").trim(),
    company_name: "",
    address_line1: addr.line1.trim(),
    address_line2: (addr.line2 ?? "").trim(),
    city_locality: addr.city.trim(),
    state_province: normalizeUsStateProvinceForShipping("US", st),
    postal_code: zip,
    country_code: "US",
    residential: "unknown",
  }
}

function pickReswellRate(rates: PublicShippingRateRow[]): PublicShippingRateRow | undefined {
  if (!rates.length) return undefined
  const best = rates.find((r) => r.attributes.includes("best_value"))
  return best ?? rates[0]
}

/**
 * Live ShipEngine quote (USD) for peer surfboard checkout when the listing uses Reswell-calculated shipping.
 */
export async function quoteReswellPeerShippingUsd(input: {
  listing: PeerListingForShippingQuote
  buyerAddress: ProfileAddressRow
}): Promise<{ ok: true; shippingUsd: number } | { ok: false; error: string }> {
  const { listing, buyerAddress } = input

  const lat = listing.latitude != null && listing.latitude !== "" ? Number(listing.latitude) : NaN
  const lng = listing.longitude != null && listing.longitude !== "" ? Number(listing.longitude) : NaN
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, error: "Seller location is missing — shipping cannot be calculated." }
  }

  const shipFromParts = await reverseGeocodeShipFromParts(lat, lng)
  if (!shipFromParts) {
    return { ok: false, error: "Could not resolve the seller’s ship-from address for rating." }
  }

  const shipTo = buyerShipTo(buyerAddress)
  if (!shipTo) {
    return {
      ok: false,
      error: "A complete US shipping address (including state and ZIP) is required.",
    }
  }

  const parcel = resolvePackedParcelFromListing(listing)
  if (!parcel.ok) {
    return { ok: false, error: parcel.error }
  }

  const estimate: SurfboardShippingEstimateInput = {
    shipFrom: sellerShipFromFriendly(shipFromParts),
    shipTo,
    weightOz: parcel.weightOz,
    lengthIn: parcel.lengthIn,
    widthIn: parcel.widthIn,
    heightIn: parcel.heightIn,
  }

  const result = await getTopSurfboardShippingRates(estimate, { topN: 30 })
  if (!result.ok) {
    return { ok: false, error: result.error }
  }

  const chosen = pickReswellRate(result.rates)
  if (!chosen) {
    return { ok: false, error: "No carrier rates returned for this shipment." }
  }

  if (chosen.currency && chosen.currency.toUpperCase() !== "USD") {
    return { ok: false, error: "Unsupported currency from carrier quote." }
  }

  return { ok: true, shippingUsd: chosen.totalAmount }
}

/**
 * Item + shipping total for surfboard peer checkout (flat/free from DB, Reswell from ShipEngine).
 */
export async function computePeerCheckoutTotalsUsd(input: {
  listing: PeerListingForShippingQuote & { price: string | number }
  fulfillment: "pickup" | "shipping"
  buyerAddress: ProfileAddressRow | null
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
  const q = await quoteReswellPeerShippingUsd({
    listing: input.listing,
    buyerAddress: input.buyerAddress,
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
