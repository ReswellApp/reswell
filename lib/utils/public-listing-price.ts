import { listingCompareAtPriceForDisplay } from "@/lib/listing-compare-at-price"

/**
 * Public listing price — always the seller's original list price on `listings.price`.
 *
 * Negotiated offer amounts live on `offers` and apply only at checkout for the buyer.
 * Sold feeds, PDPs, and browse surfaces must never show discounted offer prices.
 */
export function publicListingListPriceUsd(price: string | number | null | undefined): number {
  const n = typeof price === "number" ? price : parseFloat(String(price ?? "0"))
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * 100) / 100
}

/** Seller-opted “was” price, or null when it should not be shown. */
export function publicListingCompareAtPriceUsd(
  compareAt: string | number | null | undefined,
  listPriceUsd: number,
): number | null {
  return listingCompareAtPriceForDisplay(listPriceUsd, compareAt)
}
