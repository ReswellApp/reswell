/**
 * Listing → Meta Commerce catalog feed item (CSV / JSON scheduled data feeds).
 */

import { listingDetailHref } from "@/lib/listing-href"
import { primaryListingImageUrl } from "@/lib/listing-metadata"
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

function absoluteCatalogImageUrl(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  return absolutePublicMediaUrl(raw.trim()) ?? null
}

/** Raw storage URL from listing photos — direct public URLs Meta can crawl (not /media/listings proxy). */
function listingImageRaw(listing: MetaListingProductSource): string | null {
  const images = listing.listing_images ?? null
  const normalized = images?.map((image) => ({
    url: image.url,
    is_primary: image.is_primary ?? undefined,
    sort_order: image.sort_order ?? undefined,
  }))
  const primary = primaryListingImageUrl(normalized)
  if (primary?.trim()) return primary.trim()
  const first = images?.[0]
  const thumb = first?.thumbnail_url?.trim()
  if (thumb) return thumb
  const url = first?.url?.trim()
  return url || null
}

function orderedListingImageRaws(listing: MetaListingProductSource): string[] {
  const images = listing.listing_images ?? []
  if (images.length === 0) return []

  const sorted = images.slice().sort(
    (a, b) =>
      (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) ||
      (a.sort_order ?? 0) - (b.sort_order ?? 0),
  )

  const urls: string[] = []
  for (const img of sorted) {
    const full = img.url?.trim()
    if (full) {
      urls.push(full)
      continue
    }
    const thumb = img.thumbnail_url?.trim()
    if (thumb) urls.push(thumb)
  }
  return urls
}

function primaryImageLink(listing: MetaListingProductSource): string | null {
  return absoluteCatalogImageUrl(listingImageRaw(listing))
}

function additionalImageLinks(listing: MetaListingProductSource, primary: string): string | undefined {
  const extras = orderedListingImageRaws(listing)
    .map((raw) => absoluteCatalogImageUrl(raw))
    .filter((url): url is string => Boolean(url) && url !== primary)

  const unique = [...new Set(extras)]
  if (unique.length === 0) return undefined
  return unique.join(",")
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
