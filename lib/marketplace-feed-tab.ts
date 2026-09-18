export type MarketplaceFeedTab = "new" | "sold" | "shipped"

export function parseMarketplaceFeedTab(raw: string | undefined): MarketplaceFeedTab {
  if (raw === "new") return "new"
  if (raw === "shipped") return "shipped"
  return "sold"
}

export type MarketplaceFeedHrefOptions = {
  brandSlug?: string | null
  /** 1-based page for the new-listings and shipped tabs. */
  page?: number
}

/** Canonical marketplace feed URL (`/sold`); optional `tab=new`, brand filter, and page. */
export function marketplaceFeedHref(
  tab: MarketplaceFeedTab,
  options?: MarketplaceFeedHrefOptions | string | null,
): string {
  const opts: MarketplaceFeedHrefOptions =
    typeof options === "string" || options == null
      ? { brandSlug: typeof options === "string" ? options : null }
      : options

  const params = new URLSearchParams()
  if (tab === "new") params.set("tab", "new")
  else if (tab === "shipped") params.set("tab", "shipped")
  const slug = opts.brandSlug?.trim()
  if (slug) params.set("brandSlug", slug)
  if ((tab === "new" || tab === "shipped") && opts.page != null && opts.page > 1) {
    params.set("page", String(Math.floor(opts.page)))
  }
  const qs = params.toString()
  return qs ? `/sold?${qs}` : "/sold"
}

export function parseMarketplaceFeedPage(raw: string | undefined): number {
  const n = parseInt(raw ?? "1", 10)
  return Number.isFinite(n) && n > 0 ? n : 1
}

export function sliceMarketplaceFeedPage<T>(
  items: readonly T[],
  page: number,
  pageSize: number,
): { pageItems: T[]; page: number; totalCount: number; totalPages: number } {
  const totalCount = items.length
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize) || 1)
  const safePage = Math.max(1, Math.floor(page) || 1)
  const start = (safePage - 1) * pageSize
  return {
    pageItems: items.slice(start, start + pageSize),
    page: safePage,
    totalCount,
    totalPages,
  }
}
