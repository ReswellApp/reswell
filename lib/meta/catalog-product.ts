/**
 * Listing → Meta Commerce catalog feed item (CSV / JSON scheduled data feeds).
 */

import { listingDetailHref } from "@/lib/listing-href"
import { listingHeroSlideSrc, listingTileCarouselImageUrls } from "@/lib/listing-image-display"
import { publicSiteOrigin } from "@/lib/public-site-origin"
import { absolutePublicMediaUrl } from "@/lib/site-metadata"

export type MetaListingImage = {
  url?: string | null
  thumbnail_url?: string | null
  is_primary?: boolean | null
  sort_order?: number | null
}

export type MetaListingProductSource = {
  id: string
  slug?: string | null
  title?: string | null
  description?: string | null
  price?: string | number | null
  section?: string | null
  brand?: string | null
  condition?: string | null
  status?: string | null
  hidden_from_site?: boolean | null
  listing_images?: MetaListingImage[] | null
}

/** Meta Commerce catalog row (required fields for dynamic ads / catalog sales). */
export type MetaCatalogFeedItem = {
  id: string
  title: string
  description: string
  availability: "in stock" | "out of stock"
  condition: "new" | "used" | "refurbished"
  price: string
  link: string
  image_link: string
  brand?: string
  google_product_category: string
  additional_image_link?: string
  identifier_exists: "no"
}

const MAX_DESCRIPTION_LENGTH = 5000
const DEFAULT_GOOGLE_PRODUCT_CATEGORY = "499811"

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

export function getMetaCatalogGoogleProductCategory(): string {
  return process.env.META_CATALOG_GOOGLE_PRODUCT_CATEGORY?.trim() || DEFAULT_GOOGLE_PRODUCT_CATEGORY
}

export function parseMetaListingPrice(
  price: string | number | null | undefined,
): number | null {
  const num = typeof price === "number" ? price : parseFloat(String(price ?? ""))
  if (!Number.isFinite(num) || num <= 0) return null
  return Math.round(num * 100) / 100
}

function listingTitle(listing: MetaListingProductSource): string {
  const title = typeof listing.title === "string" ? listing.title.trim() : ""
  return title || "Untitled listing"
}

function mapCondition(condition: string | null | undefined): "new" | "used" | "refurbished" {
  const value = (condition ?? "").trim()
  if (value === "brand_new" || value === "new") return "new"
  if (value === "refurbished") return "refurbished"
  return "used"
}

function absoluteListingUrl(listing: MetaListingProductSource): string {
  const section = String(listing.section ?? "surfboards")
  const path = listingDetailHref({
    id: listing.id,
    slug: listing.slug ?? undefined,
    section,
  })
  return `${publicSiteOrigin()}${path}`
}

function absoluteImageUrl(relativeOrAbsolute: string): string {
  if (/^https?:\/\//i.test(relativeOrAbsolute)) return relativeOrAbsolute
  return absolutePublicMediaUrl(relativeOrAbsolute) ?? `${publicSiteOrigin()}${relativeOrAbsolute.startsWith("/") ? "" : "/"}${relativeOrAbsolute}`
}

function primaryImageLink(listing: MetaListingProductSource): string | null {
  const relativeOrAbsolute = listingHeroSlideSrc(listing.listing_images)
  if (!relativeOrAbsolute) return null
  return absoluteImageUrl(relativeOrAbsolute)
}

function additionalImageLinks(listing: MetaListingProductSource, primary: string): string | undefined {
  const carousel = listingTileCarouselImageUrls(listing.listing_images)
  const extras = carousel
    .slice(1)
    .map((url) => absoluteImageUrl(url))
    .filter((url) => url !== primary)
  if (extras.length === 0) return undefined
  return extras.join(",")
}

function catalogDescription(listing: MetaListingProductSource): string {
  const raw =
    typeof listing.description === "string" ? listing.description.trim() : ""
  const stripped = stripHtml(raw)
  if (stripped) {
    return stripped.length > MAX_DESCRIPTION_LENGTH
      ? `${stripped.slice(0, MAX_DESCRIPTION_LENGTH - 1)}…`
      : stripped
  }
  return `${listingTitle(listing)} on Reswell`
}

function formatMetaPrice(amount: number): string {
  return `${amount.toFixed(2)} USD`
}

export function isMetaCatalogEligibleListing(listing: MetaListingProductSource): boolean {
  if (listing.section !== "surfboards") return false
  if (listing.status !== "active") return false
  if (listing.hidden_from_site === true) return false
  if (!listing.id?.trim()) return false
  if (!listingTitle(listing)) return false
  if (parseMetaListingPrice(listing.price) == null) return false
  if (!primaryImageLink(listing)) return false
  return true
}

export function listingToMetaCatalogFeedItem(
  listing: MetaListingProductSource,
): MetaCatalogFeedItem | null {
  if (!isMetaCatalogEligibleListing(listing)) return null

  const priceAmount = parseMetaListingPrice(listing.price)
  if (priceAmount == null) return null

  const imageLink = primaryImageLink(listing)
  if (!imageLink) return null

  const brand = typeof listing.brand === "string" ? listing.brand.trim() : ""

  return {
    id: listing.id,
    title: listingTitle(listing),
    description: catalogDescription(listing),
    availability: "in stock",
    condition: mapCondition(listing.condition),
    price: formatMetaPrice(priceAmount),
    link: absoluteListingUrl(listing),
    image_link: imageLink,
    brand: brand || undefined,
    google_product_category: getMetaCatalogGoogleProductCategory(),
    additional_image_link: additionalImageLinks(listing, imageLink),
    identifier_exists: "no",
  }
}
