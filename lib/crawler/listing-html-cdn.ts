import { getCachedPublicListingDetailRow } from "@/lib/cache/listing-public-detail"
import { shouldCdnCacheListingHtml } from "@/lib/crawler/listing-html-cdn-policy"

export {
  listingParamFromPublicPath,
  shouldCdnCacheListingHtml,
} from "@/lib/crawler/listing-html-cdn-policy"

/**
 * Same hourly public row as `app/l/[listing]/page.tsx`. A live lookup here would
 * stamp `CDN-Cache-Control` on DynamicGate HTML after a cached miss, failed
 * select, or hide-then-publish race. Uses the Data Cache entry directly so
 * proxy does not depend on React `cache()`.
 */
export async function listingIsAnonymousPublicHtml(param: string): Promise<boolean> {
  const trimmed = param.trim()
  if (!trimmed) return false
  try {
    const { listing, queryFailed } = await getCachedPublicListingDetailRow(trimmed)
    return shouldCdnCacheListingHtml({ queryFailed, listing })
  } catch {
    return false
  }
}
