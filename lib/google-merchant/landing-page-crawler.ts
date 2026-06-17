import { isSocialPreviewMediaCrawler } from "@/lib/listing-media-crawler-guard"

/** Crawlers that fetch Merchant Center `link` landing pages (Googlebot, etc.). */
export function isGoogleMerchantLandingPageCrawler(
  userAgent: string | null | undefined,
): boolean {
  return isSocialPreviewMediaCrawler(userAgent)
}
