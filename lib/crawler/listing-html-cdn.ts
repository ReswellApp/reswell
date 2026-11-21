import { getCachedPublicListingDetailRow } from "@/lib/cache/listing-public-detail"
import { listingRendersAnonymousPublicShell } from "@/lib/crawler/listing-html-cdn-policy"

export {
  listingParamFromPublicPath,
  listingRendersAnonymousPublicShell,
  shouldAttachListingCdnCacheHeader,
  shouldCdnCacheListingHtml,
} from "@/lib/crawler/listing-html-cdn-policy"

/**
 * Whether `/l/{param}` will render the anonymous public shell on this request.
 * Uses the same hourly cache as `app/l/[listing]/page.tsx` — a live public row
 * with a cached miss is DynamicGate and must not get the public CDN header.
 */
export async function listingIsAnonymousPublicHtml(param: string): Promise<boolean> {
  const trimmed = param.trim()
  if (!trimmed) return false
  try {
    const { listing } = await getCachedPublicListingDetailRow(trimmed)
    return listingRendersAnonymousPublicShell(listing)
  } catch {
    return false
  }
}
