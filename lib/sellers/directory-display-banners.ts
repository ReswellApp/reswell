import { effectiveMinimumOfferAmount } from "@/lib/utils/offers-minimum-amount"

export type SellerDirectoryDisplayBanner = {
  kind: "promo" | "offer"
  label: string
}

export type SellerListingForDisplayBanners = {
  buyer_offers_enabled: boolean | null
  price: number | string | null
  minimum_offer_amount?: string | number | null
  minimum_offer_pct?: number | null
}

function parseListPrice(raw: number | string | null): number | null {
  if (raw == null || raw === "") return null
  const n = typeof raw === "number" ? raw : parseFloat(String(raw).trim().replace(/[$,]/g, ""))
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

function formatUsdWholeOrCents(amount: number): string {
  const rounded = Math.round(amount * 100) / 100
  return rounded % 1 === 0 ? `$${rounded.toFixed(0)}` : `$${rounded.toFixed(2)}`
}

/**
 * Green mosaic pills on `/sellers` tiles. Offer copy matches listing floors;
 * promo lines are reserved for future seller-configured cart discounts.
 */
export function deriveSellerDirectoryDisplayBanners(
  listings: SellerListingForDisplayBanners[],
  options?: { offersShipping?: boolean },
): SellerDirectoryDisplayBanner[] {
  const banners: SellerDirectoryDisplayBanner[] = []

  let acceptsOffers = false
  let lowestMinOffer: number | null = null

  for (const listing of listings) {
    if (listing.buyer_offers_enabled === false) continue
    const listPrice = parseListPrice(listing.price)
    if (listPrice == null) continue
    acceptsOffers = true
    const min = effectiveMinimumOfferAmount(listing, listPrice)
    if (lowestMinOffer == null || min < lowestMinOffer) lowestMinOffer = min
  }

  if (acceptsOffers) {
    const minFragment =
      lowestMinOffer != null ? `${formatUsdWholeOrCents(lowestMinOffer)} min` : null
    banners.push({
      kind: "offer",
      label: minFragment ? `Accepts offers · ${minFragment}` : "Accepts offers",
    })
  }

  if (options?.offersShipping && banners.length < 2) {
    banners.push({ kind: "promo", label: "Seller offers shipping" })
  }

  return banners.slice(0, 2)
}
