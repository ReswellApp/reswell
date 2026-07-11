/**
 * Shared listing → Klaviyo catalog / commerce event shapes (catalog feed + product blocks).
 */

import { listingDetailHref } from "@/lib/listing-href"
import { primaryListingImageUrl } from "@/lib/listing-metadata"
import { proxiedListingImageSrc } from "@/lib/listing-media-proxy-url"
import { resolveListingUrlForEmail } from "@/lib/klaviyo/email-listing-links"
import {
  isPeerListingSection,
  PEER_LISTING_SECTION_LABELS,
} from "@/lib/peer-listing-sections"
import { publicSiteOriginForEmail } from "@/lib/public-site-origin"

export type KlaviyoListingImage = {
  url?: string | null
  thumbnail_url?: string | null
  is_primary?: boolean | null
  sort_order?: number | null
}

export type KlaviyoListingProductSource = {
  id: string
  slug?: string | null
  title?: string | null
  description?: string | null
  price?: string | number | null
  section?: string | null
  city?: string | null
  state?: string | null
  board_type?: string | null
  brand?: string | null
  condition?: string | null
  listing_images?: KlaviyoListingImage[] | null
}

/** Klaviyo custom catalog feed item (JSON source). */
export type KlaviyoCatalogFeedItem = {
  id: string
  title: string
  link: string
  description: string
  image_link: string
  price: number
  categories: string[]
  inventory_quantity: number
  inventory_policy: 1
}

/** Klaviyo commerce event line item (Items array / product block lookup). */
export type KlaviyoEventCommerceItem = {
  ProductID: string
  ProductName: string
  Quantity: number
  ItemPrice: number
  RowTotal: number
  ProductURL: string
  ImageURL: string
}

/** Scalar-friendly checkout line for dynamic email blocks (`checkout_items`). */
export type KlaviyoCheckoutEventItem = {
  listing_id: string
  ProductID: string
  title: string
  url: string
  image_url: string
  price: number | null
  price_display: string
}

const FALLBACK_IMAGE_PATH = "/opengraph-image.jpg"
const MAX_DESCRIPTION_LENGTH = 5000

export function parseKlaviyoListingPrice(
  price: string | number | null | undefined,
): number | null {
  const num = typeof price === "number" ? price : parseFloat(String(price ?? ""))
  if (!Number.isFinite(num) || num < 0) return null
  return Math.round(num * 100) / 100
}

export function formatKlaviyoPriceDisplay(price: number | null): string {
  if (price == null || !Number.isFinite(price)) return ""
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price)
  } catch {
    return `$${Math.round(price)}`
  }
}

function listingTitle(listing: KlaviyoListingProductSource): string {
  const title = typeof listing.title === "string" ? listing.title.trim() : ""
  return title || "Untitled listing"
}

function listingImageRaw(listing: KlaviyoListingProductSource): string | null {
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

/** Same-origin `/media/listings/...` URL for Klaviyo email properties and catalog feeds. */
export function absoluteKlaviyoListingPhotoUrl(
  raw: string | null | undefined,
): string {
  const proxied = proxiedListingImageSrc(raw)
  const origin = publicSiteOriginForEmail().replace(/\/$/, "")
  if (!proxied.trim()) {
    return `${origin}${FALLBACK_IMAGE_PATH.startsWith("/") ? FALLBACK_IMAGE_PATH : `/${FALLBACK_IMAGE_PATH}`}`
  }
  if (/^https?:\/\//i.test(proxied)) return proxied
  return `${origin}${proxied.startsWith("/") ? proxied : `/${proxied}`}`
}

export function absoluteKlaviyoListingImageUrl(
  listing: KlaviyoListingProductSource,
): string {
  return absoluteKlaviyoListingPhotoUrl(listingImageRaw(listing))
}

export function absoluteKlaviyoListingUrl(listing: KlaviyoListingProductSource): string {
  const section = String(listing.section ?? "surfboards")
  const path = listingDetailHref({
    id: listing.id,
    slug: listing.slug ?? undefined,
    section,
  })
  const origin = publicSiteOriginForEmail()
  const relativeOrAbsolute = `${origin}${path}`
  return resolveListingUrlForEmail({
    url: relativeOrAbsolute,
    listing_id: listing.id,
  })
}

function catalogDescription(listing: KlaviyoListingProductSource): string {
  const raw =
    typeof listing.description === "string" ? listing.description.trim() : ""
  const stripped = raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
  if (stripped) {
    return stripped.length > MAX_DESCRIPTION_LENGTH
      ? `${stripped.slice(0, MAX_DESCRIPTION_LENGTH - 1)}…`
      : stripped
  }

  const city = typeof listing.city === "string" ? listing.city.trim() : ""
  const state = typeof listing.state === "string" ? listing.state.trim() : ""
  const location = city && state ? `${city}, ${state}` : city || state
  const title = listingTitle(listing)
  if (location) return `${title} — ${location}`
  return `${title} on Reswell`
}

function catalogSectionCategory(section: string): string {
  return isPeerListingSection(section)
    ? PEER_LISTING_SECTION_LABELS[section]
    : section
}

function catalogCategories(listing: KlaviyoListingProductSource): string[] {
  const categories = new Set<string>()
  const section = typeof listing.section === "string" ? listing.section.trim() : ""
  if (section) {
    categories.add(catalogSectionCategory(section))
    categories.add(`section_${section}`)
  }
  const boardType =
    typeof listing.board_type === "string" ? listing.board_type.trim() : ""
  if (boardType) categories.add(boardType)
  const brand = typeof listing.brand === "string" ? listing.brand.trim() : ""
  if (brand) categories.add(brand)
  const condition =
    typeof listing.condition === "string" ? listing.condition.trim() : ""
  if (condition) categories.add(condition)
  if (categories.size === 0) categories.add("surfboards")
  return [...categories]
}

export function listingToKlaviyoCatalogFeedItem(
  listing: KlaviyoListingProductSource,
): KlaviyoCatalogFeedItem {
  const price = parseKlaviyoListingPrice(listing.price) ?? 0
  return {
    id: listing.id,
    title: listingTitle(listing),
    link: absoluteKlaviyoListingUrl(listing),
    description: catalogDescription(listing),
    image_link: absoluteKlaviyoListingImageUrl(listing),
    price,
    categories: catalogCategories(listing),
    inventory_quantity: 1,
    inventory_policy: 1,
  }
}

export function listingToKlaviyoEventCommerceItem(
  listing: KlaviyoListingProductSource,
  quantity = 1,
): KlaviyoEventCommerceItem {
  const itemPrice = parseKlaviyoListingPrice(listing.price) ?? 0
  const qty = Math.max(1, quantity)
  return {
    ProductID: listing.id,
    ProductName: listingTitle(listing),
    Quantity: qty,
    ItemPrice: itemPrice,
    RowTotal: Math.round(itemPrice * qty * 100) / 100,
    ProductURL: absoluteKlaviyoListingUrl(listing),
    ImageURL: absoluteKlaviyoListingImageUrl(listing),
  }
}

export function listingToKlaviyoCheckoutEventItem(
  listing: KlaviyoListingProductSource,
): KlaviyoCheckoutEventItem {
  const price = parseKlaviyoListingPrice(listing.price)
  return {
    listing_id: listing.id,
    ProductID: listing.id,
    title: listingTitle(listing),
    url: absoluteKlaviyoListingUrl(listing),
    image_url: absoluteKlaviyoListingImageUrl(listing),
    price,
    price_display: formatKlaviyoPriceDisplay(price),
  }
}

export function klaviyoCommerceEventProperties(input: {
  primaryProductId: string
  items: KlaviyoEventCommerceItem[]
}): {
  ProductID: string
  Items: KlaviyoEventCommerceItem[]
} {
  return {
    ProductID: input.primaryProductId,
    Items: input.items,
  }
}
