/**
 * Builds event properties Klaviyo can use in inactive-user flows (`featured_listings` array — dynamic blocks).
 */

import type { RecentPublicListingRowForKlaviyo } from "@/lib/db/recentPublicListingsForKlaviyo"
import { KLAVIYO_INACTIVITY_LISTINGS_CAP } from "@/lib/db/recentPublicListingsForKlaviyo"
import { listingDetailPath } from "@/lib/listing-query"
import { publicSiteOrigin } from "@/lib/public-site-origin"

/** Scalar-friendly objects for Klaviyo (iterate `featured_listings` in dynamic email blocks). */
export type KlaviyoInactiveFeaturedListing = {
  listing_id: string
  title: string
  /** Absolute URL to listing PDP */
  url: string
  image_url: string
  price: number | null
  /** e.g. "$450" — empty when price missing */
  price_display: string
  section: string
  location: string
}

function primaryImageUrl(images: RecentPublicListingRowForKlaviyo["listing_images"]): string | null {
  if (!Array.isArray(images) || images.length === 0) return null
  const primary =
    images.find((i) => i.is_primary === true) ?? images.find((i) => i.url?.trim()) ?? images[0]
  const u = typeof primary?.url === "string" ? primary.url.trim() : ""
  return u || null
}

function formatPriceUsd(price: number | null): string {
  if (price == null || !Number.isFinite(Number(price))) return ""
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Number(price))
  } catch {
    return `$${Math.round(Number(price))}`
  }
}

function locationLine(city: string | null, state: string | null): string {
  const c = typeof city === "string" ? city.trim() : ""
  const s = typeof state === "string" ? state.trim() : ""
  if (c && s) return `${c}, ${s}`
  return c || s || ""
}

/**
 * From the pre-fetched pool, take newest listings excluding the recipient’s own (when possible).
 */
export function pickFeaturedListingsForInactiveUser(
  pool: RecentPublicListingRowForKlaviyo[],
  recipientUserId: string,
  cap: number = KLAVIYO_INACTIVITY_LISTINGS_CAP,
): KlaviyoInactiveFeaturedListing[] {
  const trimmedRecipient = recipientUserId.trim()

  const candidates = trimmedRecipient.length
    ? pool.filter((r) => r.user_id.trim() !== trimmedRecipient)
    : [...pool]

  const origin = publicSiteOrigin()

  const out: KlaviyoInactiveFeaturedListing[] = []
  for (const row of candidates) {
    if (out.length >= cap) break

    const path = listingDetailPath({
      section: row.section,
      slug: row.slug,
      id: row.id,
    })
    const imageUrl = primaryImageUrl(row.listing_images) ?? ""

    out.push({
      listing_id: row.id,
      title:
        typeof row.title === "string" ? row.title.trim() || "Untitled listing" : "Untitled listing",
      url: `${origin}${path}`,
      image_url: imageUrl,
      price: typeof row.price === "number" && Number.isFinite(row.price) ? row.price : null,
      price_display: formatPriceUsd(
        typeof row.price === "number" && Number.isFinite(row.price) ? row.price : null,
      ),
      section: row.section,
      location: locationLine(row.city, row.state),
    })
  }

  return out
}
