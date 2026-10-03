/**
 * Client-safe snapshot of the newest listing in a saved search.
 * The save-search bar and the Klaviyo `Saved Search` event share this shape.
 */

import { klaviyoEmailListingPhotoUrl } from "@/lib/klaviyo/catalog-product"
import { listingDetailHref } from "@/lib/listing-href"
import {
  listingHeroSlideSrc,
  listingImagesFromPrimaryFields,
} from "@/lib/listing-image-display"
import { publicSiteOriginForEmail } from "@/lib/public-site-origin"

export type SavedSearchHeroListing = {
  id: string
  title: string
  price: number
  /** Display price, e.g. `$825.00`. */
  priceLabel: string
  /** Relative listing path (`/l/{slug}`). */
  href: string
  /** Proxied full photo for the save-search bar. Empty when the listing has no photo. */
  imageSrc: string
  /** Absolute HTTPS photo for Klaviyo. Empty when the listing has no photo — never the site logo. */
  klaviyoPhotoUrl: string
  /** Absolute listing URL for the email. */
  listingUrl: string
}

export type SavedSearchHeroSource = {
  id: string
  slug?: string | null
  title?: string | null
  price: number | string | null
  section?: string | null
  primary_image_url?: string | null
  primary_thumbnail_url?: string | null
}

export function formatSavedSearchHeroPrice(price: number): string {
  return `$${price.toFixed(2)}`
}

/** Map a listing row to the hero shown in the bar and sent on `Saved Search`. */
export function savedSearchHeroFromListing(
  row: SavedSearchHeroSource,
): SavedSearchHeroListing | null {
  const id = row.id.trim()
  if (!id) return null

  const price = typeof row.price === "number" ? row.price : Number(row.price)
  if (!Number.isFinite(price)) return null

  const full = row.primary_image_url?.trim() || ""
  const thumb = row.primary_thumbnail_url?.trim() || ""
  const photoRaw = full || thumb
  const imageSrc =
    listingHeroSlideSrc(
      listingImagesFromPrimaryFields(photoRaw || null, thumb || null),
    ) ?? ""

  const href = listingDetailHref({
    id,
    slug: row.slug,
    section: row.section ?? undefined,
  })
  const origin = publicSiteOriginForEmail().replace(/\/$/, "")

  return {
    id,
    title: row.title?.trim() || "Listing",
    price,
    priceLabel: formatSavedSearchHeroPrice(price),
    href,
    imageSrc,
    klaviyoPhotoUrl: klaviyoEmailListingPhotoUrl(photoRaw),
    listingUrl: `${origin}${href}`,
  }
}
