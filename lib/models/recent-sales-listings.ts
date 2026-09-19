import type { PriceGuideComp } from "@/lib/types/price-guide"
import { isUuidString } from "@/lib/utils/isUuid"

function listingPathFromUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null
  try {
    const path = url.startsWith("http") ? new URL(url).pathname : url
    const match = path.match(/^\/l\/([^/?#]+)/)
    return match?.[1] ? decodeURIComponent(match[1]) : null
  } catch {
    return null
  }
}

/** Listing UUID from a price-guide recent-sales row, when the comp is a Reswell sale. */
export function listingIdFromPriceGuideComp(comp: PriceGuideComp): string | null {
  if (comp.id.startsWith("sale:")) {
    const id = comp.id.slice("sale:".length).trim()
    return isUuidString(id) ? id : null
  }
  const fromPath = listingPathFromUrl(comp.listing_url)
  return fromPath && isUuidString(fromPath) ? fromPath : null
}

export function listingSlugFromPriceGuideComp(comp: PriceGuideComp): string | null {
  const fromPath = listingPathFromUrl(comp.listing_url)
  if (!fromPath || isUuidString(fromPath)) return null
  return fromPath
}

export function listingIdsFromPriceGuideRecentSold(comps: readonly PriceGuideComp[]): string[] {
  const ids: string[] = []
  const seen = new Set<string>()
  for (const comp of comps) {
    const id = listingIdFromPriceGuideComp(comp)
    if (!id || seen.has(id)) continue
    seen.add(id)
    ids.push(id)
  }
  return ids
}

/** Keep only listings that appear in Recent sales, in that table’s order. */
export function orderListingsByRecentSales<T extends { id: string; slug?: string | null }>(
  listings: readonly T[],
  comps: readonly PriceGuideComp[],
): T[] {
  const byId = new Map(listings.map((listing) => [listing.id, listing]))
  const bySlug = new Map(
    listings.flatMap((listing) => {
      const slug = listing.slug?.trim()
      return slug ? [[slug, listing] as const] : []
    }),
  )
  const ordered: T[] = []
  const seen = new Set<string>()

  for (const comp of comps) {
    const id = listingIdFromPriceGuideComp(comp)
    const slug = listingSlugFromPriceGuideComp(comp)
    const listing = (id ? byId.get(id) : undefined) ?? (slug ? bySlug.get(slug) : undefined)
    if (!listing || seen.has(listing.id)) continue
    seen.add(listing.id)
    ordered.push(listing)
  }

  return ordered
}

/** Use the Recent sales sold price on matching tiles so the strip matches the table. */
export function applyRecentSalePrices<T extends { id: string; slug?: string | null; price: number; compare_at_price?: number | string | null }>(
  listings: readonly T[],
  comps: readonly PriceGuideComp[],
): T[] {
  return listings.map((listing) => {
    const comp = comps.find((row) => {
      const id = listingIdFromPriceGuideComp(row)
      const slug = listingSlugFromPriceGuideComp(row)
      return (id && id === listing.id) || (slug && slug === listing.slug)
    })
    if (!comp || !Number.isFinite(comp.sold_price_usd)) return listing
    const listPrice = Number(listing.price)
    return {
      ...listing,
      price: comp.sold_price_usd,
      compare_at_price:
        Number.isFinite(listPrice) && listPrice > comp.sold_price_usd
          ? listPrice
          : listing.compare_at_price,
    }
  })
}
