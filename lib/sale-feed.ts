import { parseMarketplaceFeedPage } from "@/lib/marketplace-feed-tab"

/** Page size for the on-sale feed (`/sale`). */
export const SALE_FEED_PAGE_SIZE = 48

export function parseSaleFeedPage(raw: string | undefined): number {
  return parseMarketplaceFeedPage(raw)
}

/** Canonical on-sale feed URL. Page 1 omits the query. */
export function saleFeedHref(page?: number): string {
  if (page == null || page <= 1) return "/sale"
  return `/sale?page=${Math.floor(page)}`
}
