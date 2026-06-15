/**
 * Builds event properties Klaviyo can use in inactive-user flows (`featured_listings` array — dynamic blocks).
 */

import type { RecentPublicListingRowForKlaviyo } from "@/lib/db/recentPublicListingsForKlaviyo"
import { KLAVIYO_INACTIVITY_LISTINGS_CAP } from "@/lib/db/recentPublicListingsForKlaviyo"
import type { InactiveUserPreferences } from "@/lib/db/inactiveUserPreferences"
import { resolveListingUrlForEmail } from "@/lib/klaviyo/email-listing-links"
import { listingDetailPath } from "@/lib/listing-query"
import { publicSiteOriginForEmail } from "@/lib/public-site-origin"

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
 * Relevance score for one candidate listing against a user's affinity profile.
 * Brand match is weighted highest (explicit/behavioral intent), then section,
 * then price band, then geography. Returns 0 when there is no signal.
 */
function scoreListingForPreferences(
  row: RecentPublicListingRowForKlaviyo,
  prefs: InactiveUserPreferences,
): number {
  if (!prefs.hasSignal) return 0

  let score = 0

  const brand = typeof row.brand === "string" ? row.brand.trim().toLowerCase() : ""
  if (brand && prefs.brands.has(brand)) score += 4

  const section = typeof row.section === "string" ? row.section.trim().toLowerCase() : ""
  if (section && prefs.sections.has(section)) score += 2

  if (typeof row.price === "number" && Number.isFinite(row.price)) {
    const aboveMin = prefs.priceMin == null || row.price >= prefs.priceMin
    const belowMax = prefs.priceMax == null || row.price <= prefs.priceMax
    if ((prefs.priceMin != null || prefs.priceMax != null) && aboveMin && belowMax) {
      score += 1
    }
  }

  const state = typeof row.state === "string" ? row.state.trim().toLowerCase() : ""
  if (state && prefs.state && state === prefs.state) score += 1

  return score
}

/**
 * From the pre-fetched pool, select listings for the recipient, excluding their own.
 *
 * When `preferences` carry a signal, candidates are ranked by relevance (brand /
 * section / price band / location) with newest-first as the tiebreak. With no
 * signal it falls back to plain newest-first (the pool is already ordered).
 */
export function pickFeaturedListingsForInactiveUser(
  pool: RecentPublicListingRowForKlaviyo[],
  recipientUserId: string,
  cap: number = KLAVIYO_INACTIVITY_LISTINGS_CAP,
  preferences?: InactiveUserPreferences,
): KlaviyoInactiveFeaturedListing[] {
  const trimmedRecipient = recipientUserId.trim()

  const candidates = trimmedRecipient.length
    ? pool.filter((r) => r.user_id.trim() !== trimmedRecipient)
    : [...pool]

  // Rank by relevance when we have a preference signal. The pool is newest-first,
  // so a stable sort on score keeps newest-first ordering within equal scores.
  const ranked =
    preferences?.hasSignal
      ? candidates
          .map((row, index) => ({ row, index, score: scoreListingForPreferences(row, preferences) }))
          .sort((a, b) => (b.score - a.score) || (a.index - b.index))
          .map((entry) => entry.row)
      : candidates

  const origin = publicSiteOriginForEmail()

  const out: KlaviyoInactiveFeaturedListing[] = []
  for (const row of ranked) {
    if (out.length >= cap) break

    const path = listingDetailPath({
      section: row.section,
      slug: row.slug,
      id: row.id,
    })
    const imageUrl = primaryImageUrl(row.listing_images) ?? ""

    const relativeOrAbsolute = `${origin}${path}`

    out.push({
      listing_id: row.id,
      title:
        typeof row.title === "string" ? row.title.trim() || "Untitled listing" : "Untitled listing",
      url: resolveListingUrlForEmail({ url: relativeOrAbsolute, listing_id: row.id }),
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
