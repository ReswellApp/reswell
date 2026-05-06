import { publicSiteOriginForEmail } from "@/lib/public-site-origin"

/**
 * Ensures listing links in Klaviyo HTML/text point at the Reswell marketplace host
 * (`publicSiteOriginForEmail()`), preserving `/l/...` path + query from the stored URL.
 */
export function resolveListingUrlForEmail(listing: {
  url: string
  listing_id: string
}): string {
  const origin = publicSiteOriginForEmail().replace(/\/$/, "")
  const id = listing.listing_id.trim()
  const raw = listing.url.trim()

  try {
    if (raw.startsWith("/")) {
      return `${origin}${raw}`
    }
    const u = new URL(raw)
    if (u.pathname.startsWith("/l/")) {
      return `${origin}${u.pathname}${u.search}${u.hash}`
    }
  } catch {
    /* use id fallback */
  }

  return `${origin}/l/${encodeURIComponent(id)}`
}

export function resolveMarketplaceBoardsUrlForEmail(): string {
  return `${publicSiteOriginForEmail().replace(/\/$/, "")}/boards`
}
