import { effectiveBoardShippingMode, listingUsesBoardShipperFlatRates } from "@/lib/services/peerListingShippingQuote"

type ShippingModeListing = {
  board_shipping_cost_mode?: string | null
  shipping_price?: string | number | null
  shipping_package_tier?: string | null
  shipping_package_band?: string | null
}

/** True when checkout must call `/api/checkout/shipping-quote` (live ShipEngine or BoardShipper flat). */
export function peerCheckoutNeedsLiveShippingQuote(listings: ShippingModeListing[]): boolean {
  if (listings.length === 0) return false
  return listings.some(
    (l) =>
      effectiveBoardShippingMode(l) === "reswell" || listingUsesBoardShipperFlatRates(l),
  )
}

/** Flat/free bundle or single-item shipping total — no ShipEngine round trip. */
export function computeStaticPeerShippingQuoteUsd(
  listings: ShippingModeListing[],
  itemSubtotalUsd: number,
): { shippingUsd: number; totalUsd: number; usedReswellQuote: false } {
  const shippingUsd =
    Math.round(
      listings.reduce((sum, l) => {
        const mode = effectiveBoardShippingMode(l)
        if (mode === "free") return sum
        if (mode === "flat") {
          return sum + Math.max(0, parseFloat(String(l.shipping_price ?? 0)) || 0)
        }
        return sum
      }, 0) * 100,
    ) / 100

  return {
    shippingUsd,
    totalUsd: Math.round((itemSubtotalUsd + shippingUsd) * 100) / 100,
    usedReswellQuote: false,
  }
}

export function listingHasShippingModeFields(listing: CheckoutListing): ShippingModeListing {
  return {
    board_shipping_cost_mode: listing.board_shipping_cost_mode,
    shipping_price: listing.shipping_price,
    shipping_package_tier: listing.shipping_package_tier,
    shipping_package_band: listing.shipping_package_band,
  }
}
