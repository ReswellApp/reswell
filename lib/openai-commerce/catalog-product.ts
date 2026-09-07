/**
 * Listing → ChatGPT / OpenAI Commerce product feed row.
 * @see https://developers.openai.com/commerce/specs/file-upload/products
 */

import { withOpenAiCatalogTracking } from "@/lib/ads/tracking-urls"
import { apparelSizeLabel } from "@/lib/apparel-listing-config"
import { finSizeLabel } from "@/lib/fin-listing-config"
import { mapListingConditionToGoogleMerchant } from "@/lib/google-merchant/condition"
import {
  googleMerchantListingImageSourceUrl,
  googleMerchantListingImageUrl,
} from "@/lib/google-merchant/product-image-link"
import { capitalizeWords } from "@/lib/listing-labels"
import type { ListingImageForCard } from "@/lib/listing-image-display"
import { listingDirectPublicImageUrl } from "@/lib/listing-media-proxy-url"
import { isListingDiscoveryEligible } from "@/lib/listing-public-visibility"
import { LISTING_VIDEO_MIN_DURATION_SECONDS } from "@/lib/listing-video-constants"
import {
  getOpenAiCatalogCustomLabel0,
  getOpenAiCatalogEstimatedShippingUsd,
  getOpenAiCatalogHaydenShopCustomLabel,
  getOpenAiCatalogOutSurfingShopCustomLabel,
  getOpenAiCatalogProductCategory,
  isOpenAiCatalogSection,
  OPENAI_CATALOG_DEFAULT_BRAND,
  OPENAI_CATALOG_MAX_ADDITIONAL_IMAGES,
  OPENAI_CATALOG_MAX_BRAND_LENGTH,
  OPENAI_CATALOG_MAX_DESCRIPTION_LENGTH,
  OPENAI_CATALOG_MAX_MPN_LENGTH,
  OPENAI_CATALOG_MAX_SELLER_NAME_LENGTH,
  OPENAI_CATALOG_MAX_SIZE_LENGTH,
  OPENAI_CATALOG_MAX_TITLE_LENGTH,
  OPENAI_CATALOG_MERCHANT_NAME,
} from "@/lib/openai-commerce/config"
import { publicSiteOrigin } from "@/lib/public-site-origin"
import { isReswellShopListing } from "@/lib/reswell-shop"
import { sellerProfileHref } from "@/lib/seller-slug"
import { effectiveBoardShippingMode } from "@/lib/services/peerListingShippingQuote"
import { absoluteUrl } from "@/lib/site-metadata"
import { wetsuitSizeLabel } from "@/lib/wetsuit-listing-config"

export type OpenAiCatalogListingImage = ListingImageForCard & {
  sort_order?: number | null
}

export type OpenAiCatalogSellerProfile = {
  seller_slug?: string | null
  display_name?: string | null
  shop_name?: string | null
  is_shop?: boolean | null
}

export type OpenAiCatalogListingRow = {
  id: string
  user_id?: string | null
  slug?: string | null
  title?: string | null
  description?: string | null
  price?: string | number | null
  compare_at_price?: string | number | null
  stock_quantity?: string | number | null
  section?: string | null
  status?: string | null
  hidden_from_site?: boolean | null
  archived_at?: string | null
  brand?: string | null
  model?: string | null
  condition?: string | null
  board_type?: string | null
  dimensions?: string | null
  fins_setup?: string | null
  fin_system?: string | null
  fin_size?: string | null
  wetsuit_size?: string | null
  apparel_kind?: string | null
  apparel_size?: string | null
  magazine_year?: number | null
  city?: string | null
  state?: string | null
  local_pickup?: boolean | null
  shipping_available?: boolean | null
  shipping_price?: string | number | null
  board_shipping_cost_mode?: string | null
  shipping_packed_length_in?: string | number | null
  shipping_packed_width_in?: string | number | null
  shipping_packed_height_in?: string | number | null
  shipping_packed_weight_oz?: string | number | null
  listing_images?: OpenAiCatalogListingImage[] | null
  listing_videos?: Array<{
    url?: string | null
    sort_order?: number | null
    duration_seconds?: number | null
  }> | null
  profiles?: OpenAiCatalogSellerProfile | OpenAiCatalogSellerProfile[] | null
}

export type OpenAiCatalogFeedContext = {
  haydenShopUserId: string | null
  outSurfingShopUserId: string | null
}

/** Flat-file row using OpenAI's stable product schema field names. */
export type OpenAiCatalogFeedItem = {
  is_eligible_search: "true" | "false"
  is_eligible_checkout: "true" | "false"
  is_ads_eligible: "true" | "false"
  item_id: string
  title: string
  description: string
  url: string
  brand: string
  image_url: string
  additional_image_urls?: string
  video_url?: string
  price: string
  sale_price?: string
  availability: "in_stock" | "out_of_stock"
  condition: "new" | "used" | "refurbished"
  product_category: string
  seller_name: string
  marketplace_seller: string
  seller_url: string
  seller_privacy_policy: string
  seller_tos: string
  target_countries: string
  store_country: string
  is_digital: "false"
  mpn?: string
  shipping?: string
  pickup_method?: "in_store" | "not_supported"
  accepts_returns: "true" | "false"
  return_deadline_in_days: string
  accepts_exchanges: "false"
  return_policy: string
  size?: string
  size_system?: string
  listing_has_variations: "false"
  length?: string
  width?: string
  height?: string
  dimensions?: string
  dimensions_unit?: string
  weight?: string
  item_weight_unit?: string
  age_group?: string
  custom_label_0?: string
  custom_label_1?: string
  custom_label_2?: string
  custom_label_3?: string
  ads_metadata?: string
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

function clip(text: string, max: number): string {
  if (text.length <= max) return text
  return `${text.slice(0, max - 1).trimEnd()}…`
}

function parseUsd(value: string | number | null | undefined): number | null {
  const num = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""))
  if (!Number.isFinite(num) || num <= 0) return null
  return Math.round(num * 100) / 100
}

function formatUsdAmount(amount: number): string {
  return `${amount.toFixed(2)} USD`
}

function formatBoolean(value: boolean): "true" | "false" {
  return value ? "true" : "false"
}

function listingTitle(listing: OpenAiCatalogListingRow): string {
  const raw = typeof listing.title === "string" ? listing.title.trim() : ""
  if (!raw) return ""
  const letters = raw.replace(/[^A-Za-z]/g, "")
  const normalized =
    letters.length > 0 && letters === letters.toUpperCase() ? capitalizeWords(raw) : raw
  return clip(normalized, OPENAI_CATALOG_MAX_TITLE_LENGTH)
}

function unwrapSellerProfile(
  listing: OpenAiCatalogListingRow,
): OpenAiCatalogSellerProfile | null {
  const raw = listing.profiles
  if (!raw) return null
  const row = Array.isArray(raw) ? raw[0] : raw
  return row ?? null
}

function listingBrand(listing: OpenAiCatalogListingRow): string {
  const brand = listing.brand?.trim()
  return clip(brand || OPENAI_CATALOG_DEFAULT_BRAND, OPENAI_CATALOG_MAX_BRAND_LENGTH)
}

function listingSellerName(listing: OpenAiCatalogListingRow): string {
  if (isReswellShopListing(listing.section)) {
    return OPENAI_CATALOG_MERCHANT_NAME
  }
  const profile = unwrapSellerProfile(listing)
  const shop = profile?.shop_name?.trim()
  if (profile?.is_shop && shop) return clip(shop, OPENAI_CATALOG_MAX_SELLER_NAME_LENGTH)
  const display = profile?.display_name?.trim()
  if (display) return clip(display, OPENAI_CATALOG_MAX_SELLER_NAME_LENGTH)
  return "Reswell seller"
}

function listingSellerUrl(listing: OpenAiCatalogListingRow): string {
  if (isReswellShopListing(listing.section)) {
    return absoluteUrl("/reswell/shop")
  }
  const profile = unwrapSellerProfile(listing)
  return absoluteUrl(sellerProfileHref(profile))
}

function productNoun(section: string): string {
  if (section === "fins") return "surfboard fins"
  if (section === "magazines") return "surf magazine"
  if (section === "wetsuits") return "wetsuit"
  if (section === "apparel") return "surf apparel"
  if (section === "boardbags") return "board bag"
  if (section === "surfpacks") return "surfpack"
  if (section === "leashes") return "surf leash"
  if (section === "accessories") return "surf accessory"
  if (isReswellShopListing(section)) return "surf product"
  return "surfboard"
}

function catalogDescription(listing: OpenAiCatalogListingRow): string {
  const title = listingTitle(listing) || "Listing"
  const section = listing.section ?? "surfboards"
  const notes = stripHtml(typeof listing.description === "string" ? listing.description : "")
  const parts: string[] = []

  if (isReswellShopListing(section)) {
    parts.push(`${title} is a ${productNoun(section)} sold and fulfilled by Reswell.`)
  } else {
    parts.push(
      `${title} is a ${productNoun(section)} for sale on Reswell, the marketplace for surfboards and surf gear.`,
    )
  }

  if (notes) parts.push(notes)

  const specs: string[] = []
  const brand = listing.brand?.trim()
  const model = listing.model?.trim()
  if (brand) specs.push(`Brand: ${brand}`)
  if (model) specs.push(`Model: ${model}`)
  if (listing.dimensions?.trim()) specs.push(`Dimensions: ${listing.dimensions.trim()}`)
  const size = listingSize(listing)
  if (size) specs.push(`Size: ${size}`)
  if (specs.length > 0) parts.push(`${specs.join(". ")}.`)

  return clip(parts.join(" ").replace(/\s+/g, " ").trim(), OPENAI_CATALOG_MAX_DESCRIPTION_LENGTH)
}

function mapCondition(listing: OpenAiCatalogListingRow): "new" | "used" | "refurbished" {
  if (isReswellShopListing(listing.section)) return "new"
  const merchant = mapListingConditionToGoogleMerchant(listing.condition)
  if (merchant === "NEW") return "new"
  if (merchant === "REFURBISHED") return "refurbished"
  return "used"
}

function listingSize(listing: OpenAiCatalogListingRow): string | undefined {
  const raw =
    wetsuitSizeLabel(listing.wetsuit_size) ??
    apparelSizeLabel(listing.apparel_size) ??
    finSizeLabel(listing.fin_size)
  if (!raw) return undefined
  return clip(raw, OPENAI_CATALOG_MAX_SIZE_LENGTH)
}

function orderedImageRaws(listing: OpenAiCatalogListingRow): string[] {
  const images = listing.listing_images ?? []
  const sorted = images.slice().sort(
    (a, b) =>
      (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) ||
      (a.sort_order ?? 0) - (b.sort_order ?? 0),
  )
  const urls: string[] = []
  for (const img of sorted) {
    const source = googleMerchantListingImageSourceUrl(img)
    if (source) urls.push(source)
  }
  return urls
}

function primaryImageUrl(listing: OpenAiCatalogListingRow): string | null {
  for (const raw of orderedImageRaws(listing)) {
    const resolved = googleMerchantListingImageUrl(raw)
    if (resolved) return resolved
  }
  return null
}

function additionalImageUrls(listing: OpenAiCatalogListingRow, primary: string): string | undefined {
  const extras = orderedImageRaws(listing)
    .map((raw) => googleMerchantListingImageUrl(raw))
    .filter((url): url is string => Boolean(url) && url !== primary)
  const unique = [...new Set(extras)].slice(0, OPENAI_CATALOG_MAX_ADDITIONAL_IMAGES)
  return unique.length > 0 ? unique.join(",") : undefined
}

function primaryVideoUrl(listing: OpenAiCatalogListingRow): string | undefined {
  const videos = listing.listing_videos ?? []
  const sorted = videos.slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  for (const video of sorted) {
    const duration = video.duration_seconds
    if (
      typeof duration === "number" &&
      Number.isFinite(duration) &&
      duration < LISTING_VIDEO_MIN_DURATION_SECONDS
    ) {
      continue
    }
    const raw = video.url?.trim()
    if (!raw) continue
    const link = listingDirectPublicImageUrl(raw) ?? googleMerchantListingImageUrl(raw)
    if (link) return link
  }
  return undefined
}

function listingAvailability(listing: OpenAiCatalogListingRow): "in_stock" | "out_of_stock" {
  if (!isReswellShopListing(listing.section)) return "in_stock"
  const qty = Math.max(0, Math.floor(Number(listing.stock_quantity) || 0))
  return qty > 0 ? "in_stock" : "out_of_stock"
}

function listingPrices(listing: OpenAiCatalogListingRow): { price: string; sale_price?: string } | null {
  const current = parseUsd(listing.price)
  if (current == null) return null
  const compareAt = parseUsd(listing.compare_at_price)
  if (compareAt != null && compareAt > current) {
    return { price: formatUsdAmount(compareAt), sale_price: formatUsdAmount(current) }
  }
  return { price: formatUsdAmount(current) }
}

function listingShipping(listing: OpenAiCatalogListingRow): string | undefined {
  const ships = listing.shipping_available !== false || isReswellShopListing(listing.section)
  if (!ships) return undefined

  const mode = effectiveBoardShippingMode({
    section: listing.section,
    board_shipping_cost_mode: listing.board_shipping_cost_mode,
    shipping_price: listing.shipping_price,
  })

  if (mode === "free") return "US::Standard:0.00 USD"
  if (mode === "flat") {
    const shipUsd = Math.max(0, Number.parseFloat(String(listing.shipping_price ?? 0)) || 0)
    return `US::Standard:${formatUsdAmount(shipUsd)}`
  }
  const estimated = getOpenAiCatalogEstimatedShippingUsd(listing.section ?? "surfboards")
  return `US::Standard:${formatUsdAmount(estimated)}`
}

function packedNumber(value: string | number | null | undefined): number | null {
  const num = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""))
  if (!Number.isFinite(num) || num <= 0) return null
  return num
}

function listingPackedDimensions(listing: OpenAiCatalogListingRow): {
  length?: string
  width?: string
  height?: string
  dimensions?: string
  dimensions_unit?: string
} {
  const length = packedNumber(listing.shipping_packed_length_in)
  const width = packedNumber(listing.shipping_packed_width_in)
  const height = packedNumber(listing.shipping_packed_height_in)
  if (length == null || width == null || height == null) return {}
  return {
    length: String(length),
    width: String(width),
    height: String(height),
    dimensions: `${length}x${width}x${height} in`,
    dimensions_unit: "in",
  }
}

function listingWeight(listing: OpenAiCatalogListingRow): { weight?: string; item_weight_unit?: string } {
  const oz = packedNumber(listing.shipping_packed_weight_oz)
  if (oz == null) return {}
  return {
    weight: (Math.round((oz / 16) * 100) / 100).toFixed(2),
    item_weight_unit: "lb",
  }
}

function customLabel1(
  listing: OpenAiCatalogListingRow,
  context: OpenAiCatalogFeedContext | undefined,
): string | undefined {
  const ownerId = listing.user_id?.trim()
  if (!ownerId || !context) return undefined
  if (context.haydenShopUserId && ownerId === context.haydenShopUserId) {
    return getOpenAiCatalogHaydenShopCustomLabel()
  }
  if (context.outSurfingShopUserId && ownerId === context.outSurfingShopUserId) {
    return getOpenAiCatalogOutSurfingShopCustomLabel()
  }
  return undefined
}

export function isOpenAiCatalogEligibleListing(listing: OpenAiCatalogListingRow): boolean {
  if (!listing.section || !isOpenAiCatalogSection(listing.section)) return false
  if (
    !isListingDiscoveryEligible({
      status: listing.status ?? "",
      title: listing.title,
      hidden_from_site: listing.hidden_from_site,
      archived_at: listing.archived_at,
    })
  ) {
    return false
  }
  if (!listing.id?.trim()) return false
  if (!listingTitle(listing)) return false
  if (parseUsd(listing.price) == null) return false
  if (!primaryImageUrl(listing)) return false
  return true
}

export function listingToOpenAiCatalogFeedItem(
  listing: OpenAiCatalogListingRow,
  context?: OpenAiCatalogFeedContext,
): OpenAiCatalogFeedItem | null {
  if (!isOpenAiCatalogEligibleListing(listing)) return null

  const prices = listingPrices(listing)
  const imageUrl = primaryImageUrl(listing)
  if (!prices || !imageUrl) return null

  const section = listing.section ?? "surfboards"
  const origin = publicSiteOrigin()
  const identifier = listing.slug?.trim() || listing.id
  const url = withOpenAiCatalogTracking(`${origin}/l/${encodeURIComponent(identifier)}`, listing.id)
  const availability = listingAvailability(listing)
  const inStock = availability === "in_stock"
  const ships = listing.shipping_available !== false || isReswellShopListing(section)
  const shop = isReswellShopListing(section)
  const size = listingSize(listing)
  const model = listing.model?.trim()
  const packed = listingPackedDimensions(listing)
  const weight = listingWeight(listing)
  const label1 = customLabel1(listing, context)

  return {
    is_eligible_search: formatBoolean(inStock),
    is_eligible_checkout: "false",
    is_ads_eligible: formatBoolean(inStock),
    item_id: listing.id,
    title: listingTitle(listing),
    description: catalogDescription(listing),
    url,
    brand: listingBrand(listing),
    image_url: imageUrl,
    additional_image_urls: additionalImageUrls(listing, imageUrl),
    video_url: primaryVideoUrl(listing),
    price: prices.price,
    sale_price: prices.sale_price,
    availability,
    condition: mapCondition(listing),
    product_category: getOpenAiCatalogProductCategory(section),
    seller_name: listingSellerName(listing),
    marketplace_seller: OPENAI_CATALOG_MERCHANT_NAME,
    seller_url: listingSellerUrl(listing),
    seller_privacy_policy: absoluteUrl("/privacy"),
    seller_tos: absoluteUrl("/terms"),
    target_countries: "US",
    store_country: "US",
    is_digital: "false",
    mpn: model ? clip(model, OPENAI_CATALOG_MAX_MPN_LENGTH) : undefined,
    shipping: listingShipping(listing),
    pickup_method: listing.local_pickup ? "in_store" : ships ? "not_supported" : "in_store",
    accepts_returns: "true",
    return_deadline_in_days: shop ? "30" : "7",
    accepts_exchanges: "false",
    return_policy: absoluteUrl("/return-policy"),
    size,
    size_system: size ? "US" : undefined,
    listing_has_variations: "false",
    ...packed,
    ...weight,
    age_group: "adult",
    custom_label_0: getOpenAiCatalogCustomLabel0(section),
    custom_label_1: label1,
    custom_label_2: shop ? "shop" : "peer",
    custom_label_3: ships ? "shipping" : "pickup_only",
    ads_metadata: JSON.stringify({
      section,
      fulfillment: ships ? "shipping" : "pickup",
    }),
  }
}
