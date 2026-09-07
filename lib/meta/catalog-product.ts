/**
 * Listing → Meta Commerce catalog feed item (CSV / JSON scheduled data feeds).
 */

import { withMetaCatalogTracking } from "@/lib/ads/tracking-urls"
import { listingDetailHref } from "@/lib/listing-href"
import { primaryListingImageUrl } from "@/lib/listing-metadata"
import {
  absoluteProxiedListingMediaUrl,
  listingDirectPublicImageUrl,
} from "@/lib/listing-media-proxy-url"
import { publicSiteOrigin } from "@/lib/public-site-origin"

export type MetaListingImage = {
  url?: string | null
  thumbnail_url?: string | null
  is_primary?: boolean | null
  sort_order?: number | null
}

export type MetaListingVideo = {
  url?: string | null
  thumbnail_url?: string | null
  sort_order?: number | null
  duration_seconds?: number | null
}

export type MetaListingProductSource = {
  id: string
  user_id?: string | null
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
  listing_videos?: MetaListingVideo[] | null
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
  /** Product-set filter for Meta Ads — e.g. HaydenGarfield / OutSurfing / Brownstone shop only. */
  custom_label_0?: string
  /** Direct downloadable video file URL (Meta Advantage+ catalog ads). */
  "video[0].url"?: string
}

/** Optional feed-build context (seller → custom_label_0). */
export type MetaCatalogFeedContext = {
  haydenShopUserId: string | null
  outSurfingShopUserId: string | null
  brownstoneShopUserId: string | null
}

const MAX_DESCRIPTION_LENGTH = 5000
const DEFAULT_GOOGLE_PRODUCT_CATEGORY = "499811"

/** Peer listing sections synced to the Meta Commerce catalog feed. */
export const META_CATALOG_PEER_SECTIONS = ["surfboards", "fins", "wetsuits", "magazines"] as const

export type MetaCatalogPeerSection = (typeof META_CATALOG_PEER_SECTIONS)[number]

export function isMetaCatalogPeerSection(section: string): section is MetaCatalogPeerSection {
  return (META_CATALOG_PEER_SECTIONS as readonly string[]).includes(section)
}

/** Google taxonomy: Sporting Goods > … > Surfing > Surfboard Fins (3525). */
export const META_CATALOG_DEFAULT_FINS_GOOGLE_PRODUCT_CATEGORY = "3525"

/** Google taxonomy: Media > Magazines & Newspapers > Magazines (784). */
export const META_CATALOG_DEFAULT_MAGAZINES_GOOGLE_PRODUCT_CATEGORY = "784"

/** Google taxonomy: Sporting Goods > … > Boating & Water Sport Apparel (499813). */
export const META_CATALOG_DEFAULT_WETSUITS_GOOGLE_PRODUCT_CATEGORY = "499813"

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

export function getMetaCatalogGoogleProductCategory(): string {
  return process.env.META_CATALOG_GOOGLE_PRODUCT_CATEGORY?.trim() || DEFAULT_GOOGLE_PRODUCT_CATEGORY
}

export function getMetaCatalogFinsGoogleProductCategory(): string {
  return (
    process.env.META_CATALOG_FINS_GOOGLE_PRODUCT_CATEGORY?.trim() ||
    META_CATALOG_DEFAULT_FINS_GOOGLE_PRODUCT_CATEGORY
  )
}

export function getMetaCatalogMagazinesGoogleProductCategory(): string {
  return (
    process.env.META_CATALOG_MAGAZINES_GOOGLE_PRODUCT_CATEGORY?.trim() ||
    META_CATALOG_DEFAULT_MAGAZINES_GOOGLE_PRODUCT_CATEGORY
  )
}

export function getMetaCatalogWetsuitsGoogleProductCategory(): string {
  return (
    process.env.META_CATALOG_WETSUITS_GOOGLE_PRODUCT_CATEGORY?.trim() ||
    META_CATALOG_DEFAULT_WETSUITS_GOOGLE_PRODUCT_CATEGORY
  )
}

export function getMetaCatalogGoogleProductCategoryForSection(section: string): string {
  if (section === "fins") return getMetaCatalogFinsGoogleProductCategory()
  if (section === "magazines") return getMetaCatalogMagazinesGoogleProductCategory()
  if (section === "wetsuits") return getMetaCatalogWetsuitsGoogleProductCategory()
  return getMetaCatalogGoogleProductCategory()
}

/** Default `custom_label_0` for Hayden Garfield’s shop (Meta product-set / ads filter). */
export const META_CATALOG_DEFAULT_HAYDEN_SHOP_CUSTOM_LABEL = "HaydenGarfield"

/** Profile email for Hayden Garfield’s seller shop (fallback when USER_ID env unset). */
export const META_CATALOG_HAYDEN_SHOP_SELLER_EMAIL = "haydensbsb@gmail.com"

/** Default `custom_label_0` for OutSurfing’s shop (Meta product-set / ads filter). */
export const META_CATALOG_DEFAULT_OUTSURFING_SHOP_CUSTOM_LABEL = "OutSurfing"

/** Profile email for OutSurfing’s seller shop (fallback when USER_ID env unset). */
export const META_CATALOG_OUTSURFING_SHOP_SELLER_EMAIL = "davidacason@gmail.com"

/** Default `custom_label_0` for Brownstone’s shop (Meta product-set / ads filter). */
export const META_CATALOG_DEFAULT_BROWNSTONE_SHOP_CUSTOM_LABEL = "Brownstone"

/** Profile email for Brownstone’s seller shop (fallback when USER_ID env unset). */
export const META_CATALOG_BROWNSTONE_SHOP_SELLER_EMAIL = "eric@questavolta.com"

/**
 * Meta Commerce `custom_label_0` for Hayden Garfield shop listings.
 * Override with `META_CATALOG_HAYDEN_SHOP_CUSTOM_LABEL`.
 */
export function getMetaCatalogHaydenShopCustomLabel(): string {
  return (
    process.env.META_CATALOG_HAYDEN_SHOP_CUSTOM_LABEL?.trim() ||
    META_CATALOG_DEFAULT_HAYDEN_SHOP_CUSTOM_LABEL
  )
}

/**
 * Meta Commerce `custom_label_0` for OutSurfing shop listings.
 * Override with `META_CATALOG_OUTSURFING_SHOP_CUSTOM_LABEL`.
 */
export function getMetaCatalogOutSurfingShopCustomLabel(): string {
  return (
    process.env.META_CATALOG_OUTSURFING_SHOP_CUSTOM_LABEL?.trim() ||
    META_CATALOG_DEFAULT_OUTSURFING_SHOP_CUSTOM_LABEL
  )
}

/**
 * Meta Commerce `custom_label_0` for Brownstone shop listings.
 * Override with `META_CATALOG_BROWNSTONE_SHOP_CUSTOM_LABEL`.
 */
export function getMetaCatalogBrownstoneShopCustomLabel(): string {
  return (
    process.env.META_CATALOG_BROWNSTONE_SHOP_CUSTOM_LABEL?.trim() ||
    META_CATALOG_DEFAULT_BROWNSTONE_SHOP_CUSTOM_LABEL
  )
}

/**
 * `custom_label_0` for a listing — shop label when `user_id` matches a known seller, else omitted.
 * Use in Meta Ads: Catalog → Product sets → filter Custom Label 0 = HaydenGarfield | OutSurfing | Brownstone.
 */
export function getMetaCatalogCustomLabel0ForListing(
  listing: Pick<MetaListingProductSource, "user_id">,
  context: MetaCatalogFeedContext | undefined,
): string | undefined {
  const ownerId = typeof listing.user_id === "string" ? listing.user_id.trim() : ""
  if (!ownerId || !context) return undefined

  const haydenId = context.haydenShopUserId?.trim()
  if (haydenId && ownerId === haydenId) return getMetaCatalogHaydenShopCustomLabel()

  const outSurfingId = context.outSurfingShopUserId?.trim()
  if (outSurfingId && ownerId === outSurfingId) return getMetaCatalogOutSurfingShopCustomLabel()

  const brownstoneId = context.brownstoneShopUserId?.trim()
  if (brownstoneId && ownerId === brownstoneId) return getMetaCatalogBrownstoneShopCustomLabel()

  return undefined
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
  return withMetaCatalogTracking(`${publicSiteOrigin()}${path}`, listing.id)
}

function absoluteCatalogImageUrl(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  return absoluteProxiedListingMediaUrl(raw.trim()) ?? null
}

/** Primary listing photo as same-origin `/media/listings/...` for Meta catalog crawlers. */
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

/** Direct public storage URL — Meta requires a downloadable file, not a player page. */
function absoluteCatalogVideoUrl(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  return listingDirectPublicImageUrl(raw.trim()) ?? absoluteProxiedListingMediaUrl(raw.trim()) ?? null
}

function primaryVideoLink(listing: MetaListingProductSource): string | undefined {
  const videos = listing.listing_videos ?? []
  if (videos.length === 0) return undefined
  const sorted = videos.slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  for (const video of sorted) {
    const link = absoluteCatalogVideoUrl(video.url)
    if (link) return link
  }
  return undefined
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
  if (!listing.section || !isMetaCatalogPeerSection(listing.section)) return false
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
  context?: MetaCatalogFeedContext,
): MetaCatalogFeedItem | null {
  if (!isMetaCatalogEligibleListing(listing)) return null

  const priceAmount = parseMetaListingPrice(listing.price)
  if (priceAmount == null) return null

  const imageLink = primaryImageLink(listing)
  if (!imageLink) return null

  const brand = typeof listing.brand === "string" ? listing.brand.trim() : ""
  const customLabel0 = getMetaCatalogCustomLabel0ForListing(listing, context)
  const videoLink = primaryVideoLink(listing)

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
    google_product_category: getMetaCatalogGoogleProductCategoryForSection(
      listing.section ?? "surfboards",
    ),
    additional_image_link: additionalImageLinks(listing, imageLink),
    identifier_exists: "no",
    ...(customLabel0 ? { custom_label_0: customLabel0 } : {}),
    ...(videoLink ? { "video[0].url": videoLink } : {}),
  }
}
