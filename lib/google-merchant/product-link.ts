import { publicSiteOrigin } from "@/lib/public-site-origin"

/**
 * Absolute product landing URL for Google Merchant `link` attributes.
 * Encodes the slug/id segment and uses the canonical public origin (www in production).
 */
export function googleMerchantProductLink(
  listing: { id: string; slug?: string | null },
  origin = publicSiteOrigin(),
): string {
  const identifier = listing.slug?.trim() || listing.id
  const base = origin.endsWith("/") ? origin.slice(0, -1) : origin
  return `${base}/l/${encodeURIComponent(identifier)}`
}
