/** Copy for `/sellers`. The website and `GET /api/mobile/v1/sellers` both read this. */
export const sellersDirectoryPageCopy = {
  title: "Explore sellers on Reswell",
  description:
    "Every purchase you make on Reswell supports another surfer just like you. Browse profiles below to find sellers near you or who offer shipping to your area.",
  searchPlaceholder: "Search sellers by name, shop, or city…",
  emptyTitle: "No sellers found",
  emptyBody: "Check back soon as more sellers join Reswell.",
  emptySearchBody: "Try different search terms.",
} as const

export function sellersDirectorySummary(sellerCount: number, listingCount: number): string | null {
  if (sellerCount <= 0) return null
  const sellers = `${sellerCount} seller${sellerCount === 1 ? "" : "s"}`
  if (listingCount <= 0) return sellers
  return `${sellers} · ${listingCount} active listing${listingCount === 1 ? "" : "s"}`
}
