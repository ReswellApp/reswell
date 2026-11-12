import { findListingByParam } from "@/lib/listing-query"
import { createAnonSupabaseClient } from "@/lib/supabase/anon"
import { shouldCdnCacheListingHtml } from "@/lib/crawler/listing-html-cdn-policy"

export {
  listingParamFromPublicPath,
  shouldCdnCacheListingHtml,
} from "@/lib/crawler/listing-html-cdn-policy"

const PUBLIC_LISTING_CDN_SELECT = "id, section, hidden_from_site"

/** Anonymous lookup so owner RLS cannot mark a hidden listing as cacheable. */
export async function listingIsAnonymousPublicHtml(param: string): Promise<boolean> {
  const trimmed = param.trim()
  if (!trimmed) return false
  try {
    const { listing, queryFailed } = await findListingByParam(
      createAnonSupabaseClient(),
      trimmed,
      {
        select: PUBLIC_LISTING_CDN_SELECT,
        includeHiddenListings: false,
      },
    )
    return shouldCdnCacheListingHtml({ queryFailed, listing })
  } catch {
    return false
  }
}
