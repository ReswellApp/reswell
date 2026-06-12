import { publicSiteOriginForEmail } from "@/lib/public-site-origin"

/** Query pair for deep-linking buyers into the seller review dialog on a purchase page. */
export const BUYER_REVIEW_SELLER_QUERY = {
  key: "review",
  value: "seller",
} as const

/** Direct link for Klaviyo emails — opens the purchase page with the review dialog. */
export function buildBuyerReviewSellerUrl(orderId: string): string {
  const origin = publicSiteOriginForEmail()
  const path = `/dashboard/purchases/${encodeURIComponent(orderId)}`
  return `${origin}${path}?${BUYER_REVIEW_SELLER_QUERY.key}=${BUYER_REVIEW_SELLER_QUERY.value}`
}

export function purchasePageHasSellerReviewDeepLink(searchParams: {
  review?: string | string[] | undefined
}): boolean {
  const raw = searchParams.review
  const value = Array.isArray(raw) ? raw[0] : raw
  return value === BUYER_REVIEW_SELLER_QUERY.value
}
