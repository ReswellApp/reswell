import type { MobileDashboardPage, MobileDashboardPageId } from "@reswell/api-contract"

/** Extra-permission tools that stay on the website. */
const WEB_ONLY: ReadonlySet<MobileDashboardPageId> = new Set(["shipper", "balance-sheet", "shopify"])

const SELLING: ReadonlySet<MobileDashboardPageId> = new Set(["earnings", "offers", "sales", "seller-profile"])

const BUYING: ReadonlySet<MobileDashboardPageId> = new Set(["purchases", "favorites", "following"])

const ACCOUNT: ReadonlySet<MobileDashboardPageId> = new Set(["profile", "messages", "support"])

/** Dashboard menu rows for Me — no overview (this screen) or listings (removed from Me). */
export function meDashboardPages(pages: MobileDashboardPage[]): MobileDashboardPage[] {
  return pages.filter(
    (page) => page.id !== "overview" && page.id !== "listings" && !WEB_ONLY.has(page.id),
  )
}

export function groupMeDashboardPages(pages: MobileDashboardPage[]): {
  selling: MobileDashboardPage[]
  buying: MobileDashboardPage[]
  account: MobileDashboardPage[]
} {
  const visible = meDashboardPages(pages)
  const selling: MobileDashboardPage[] = []
  const buying: MobileDashboardPage[] = []
  const account: MobileDashboardPage[] = []
  for (const page of visible) {
    if (SELLING.has(page.id)) selling.push(page)
    else if (BUYING.has(page.id)) buying.push(page)
    else if (ACCOUNT.has(page.id)) account.push(page)
  }
  return { selling, buying, account }
}
