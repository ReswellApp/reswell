import type { Metadata } from "next"
import { listingDetailPath } from "@/lib/listing-query"
import { capitalizeWords, formatCategory } from "@/lib/listing-labels"
import { absoluteProxiedListingMediaUrl } from "@/lib/listing-media-proxy-url"
import { absoluteUrl } from "@/lib/site-metadata"

export function primaryListingImageUrl(
  images:
    | Array<{ url?: string | null; is_primary?: boolean; sort_order?: number }>
    | null
    | undefined,
): string | undefined {
  if (!images?.length) return undefined
  const sorted = images.slice().sort(
    (a, b) =>
      (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) || (a.sort_order ?? 0) - (b.sort_order ?? 0),
  )
  const url = sorted[0]?.url?.trim()
  return url || undefined
}

/**
 * The listing's first photo by gallery order (`sort_order` ascending), ignoring the
 * `is_primary` flag. Used for share previews so the social card always matches the
 * listing's leading image.
 */
export function firstListingImageUrl(
  images:
    | Array<{ url?: string | null; sort_order?: number }>
    | null
    | undefined,
): string | undefined {
  if (!images?.length) return undefined
  const sorted = images.slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  const url = sorted[0]?.url?.trim()
  return url || undefined
}

export type ListingMetaInput = {
  id: string
  slug?: string | null
  title?: string | null
  description?: string | null
  status?: string | null
  section: string
  price?: number | string | null
  brand?: string | null
  model?: string | null
  condition?: string | null
  city?: string | null
  state?: string | null
  listing_images?:
    | Array<{ url?: string | null; is_primary?: boolean; sort_order?: number }>
    | null
  categories?: { name?: string | null; slug?: string | null } | Array<{ name?: string | null; slug?: string | null }> | null
}

/** Token values for the `type:listing` SEO template. */
export function listingTemplateVars(
  listing: ListingMetaInput,
  options?: { pricePrefix?: string },
): Record<string, string | undefined> {
  const cat = listing.categories
  const catRow = cat && (Array.isArray(cat) ? cat[0] : cat)
  const categoryLabel = catRow?.name ? formatCategory(catRow.name) : undefined
  const price = typeof listing.price === "number" ? listing.price : Number.parseFloat(String(listing.price ?? ""))
  const priceLabel = options?.pricePrefix || (Number.isFinite(price) ? `$${price.toFixed(0)}` : undefined)
  const location =
    listing.city && listing.state
      ? `${listing.city}, ${listing.state}`
      : listing.city || listing.state || undefined
  return {
    title: listing.title?.trim() ? capitalizeWords(listing.title.trim()) : undefined,
    brand: listing.brand?.trim() || undefined,
    model: listing.model?.trim() || undefined,
    category: categoryLabel,
    price: priceLabel,
    condition: listing.condition?.trim() || undefined,
    location,
  }
}

/** Short subtitle for OG images (category, optional shop price). */
export function buildListingShareSubtitle(
  listing: ListingMetaInput,
  options?: { pricePrefix?: string },
): string | undefined {
  const cat = listing.categories
  const catRow = cat && (Array.isArray(cat) ? cat[0] : cat)
  const categoryLabel = catRow?.name ? formatCategory(catRow.name) : ""
  const parts: string[] = []
  if (options?.pricePrefix) parts.push(options.pricePrefix)
  if (categoryLabel) parts.push(categoryLabel)
  if (parts.length === 0) return undefined
  return parts.join(" · ")
}

/**
 * Shared SEO + Open Graph + Twitter metadata for marketplace listing detail pages.
 *
 * `og:image` / `twitter:image` always use the listing’s first photo (by gallery
 * `sort_order`) via same-origin `/media/listings/...` proxy (absolute https).
 * Listings without images fall back to the site brand asset.
 */
export function metadataForListingDetail(
  listing: ListingMetaInput,
  options?: {
    /** e.g. "$24.99" prepended to description for shop items */
    pricePrefix?: string
  },
): Metadata {
  const sold = listing.status === "sold"
  const rawTitle = listing.title?.trim() || "Listing"
  const displayTitle = capitalizeWords(rawTitle)
  const titleSuffix = sold ? " · Sold" : ""
  const title = `${displayTitle}${titleSuffix} · Reswell`

  const cat = listing.categories
  const catRow = cat && (Array.isArray(cat) ? cat[0] : cat)
  const categoryLabel = catRow?.name ? formatCategory(catRow.name) : ""

  let description =
    listing.description?.trim() ||
    (categoryLabel
      ? `${categoryLabel} — ${displayTitle} on Reswell.`
      : `${displayTitle} on Reswell.`)
  if (options?.pricePrefix) {
    description = `${options.pricePrefix} · ${description}`
  }
  description = description.slice(0, 180)

  const rawListingImage = firstListingImageUrl(listing.listing_images)
  const listingImageAbs = absoluteProxiedListingMediaUrl(rawListingImage)
  const fallbackBrandImage = absoluteUrl("/og-image.jpg")
  const shareImageUrl = listingImageAbs ?? fallbackBrandImage
  const canonicalPath = listingDetailPath(listing)
  const ogTitle = `${displayTitle}${titleSuffix}`

  return {
    title,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      title: ogTitle,
      description,
      type: "article",
      siteName: "Reswell",
      url: absoluteUrl(canonicalPath),
      images: [
        {
          url: shareImageUrl,
          alt: ogTitle,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description,
      images: [shareImageUrl],
    },
  }
}
