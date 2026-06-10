import { listingDetailHref } from "@/lib/listing-href"
import { listingHeroSlideSrc, type ListingImageForCard } from "@/lib/listing-image-display"
import { absoluteProxiedListingMediaUrl } from "@/lib/listing-media-proxy-url"
import { publicSiteOrigin } from "@/lib/public-site-origin"
import { effectiveBoardShippingMode } from "@/lib/services/peerListingShippingQuote"
import {
  GOOGLE_MERCHANT_MAX_ADDITIONAL_IMAGES,
  getGoogleMerchantContentLanguage,
  getGoogleMerchantEstimatedShippingUsd,
  getGoogleMerchantFeedLabel,
  getGoogleMerchantProductCategory,
  getGoogleMerchantUsTaxRate,
} from "./config"

export type GoogleMerchantListingImage = ListingImageForCard & {
  sort_order?: number | null
}

export type GoogleMerchantListingRow = {
  id: string
  slug: string | null
  title: string
  description: string | null
  price: number
  condition: string | null
  brand: string | null
  model?: string | null
  section: string
  status: string
  hidden_from_site?: boolean | null
  shipping_available?: boolean | null
  shipping_price?: string | number | null
  board_shipping_cost_mode?: string | null
  listing_images?: GoogleMerchantListingImage[] | null
}

type GoogleMerchantPrice = {
  amountMicros: string
  currencyCode: "USD"
}

type GoogleMerchantShipping = {
  country: string
  service?: string
  price: GoogleMerchantPrice
}

type GoogleMerchantTax = {
  country: string
  rate: number
  taxShip?: boolean
}

export type GoogleMerchantProductInputPayload = {
  offerId: string
  contentLanguage: string
  feedLabel: string
  productAttributes: {
    title: string
    description: string
    link: string
    imageLink: string
    additionalImageLinks?: string[]
    availability: "IN_STOCK" | "OUT_OF_STOCK"
    condition: "NEW" | "USED"
    price: GoogleMerchantPrice
    brand?: string
    mpn?: string
    identifierExists: boolean
    googleProductCategory: string
    shipping?: GoogleMerchantShipping[]
    taxes?: GoogleMerchantTax[]
  }
}

const MAX_MPN_LENGTH = 70

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

function mapCondition(condition: string | null | undefined): "NEW" | "USED" {
  const value = (condition ?? "").trim()
  return value === "brand_new" || value === "new" ? "NEW" : "USED"
}

function priceToMicros(amountUsd: number): string {
  return String(Math.round(amountUsd * 1_000_000))
}

function absoluteImageUrl(raw: string | null | undefined, origin: string): string | null {
  if (!raw?.trim()) return null

  const proxiedAbsolute = absoluteProxiedListingMediaUrl(raw.trim())
  if (proxiedAbsolute) return proxiedAbsolute

  if (/^https?:\/\//i.test(raw.trim())) return raw.trim()
  return `${origin}${raw.trim().startsWith("/") ? "" : "/"}${raw.trim()}`
}

function orderedListingImageRaws(listing: GoogleMerchantListingRow): string[] {
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

function absoluteImageLink(listing: GoogleMerchantListingRow, origin: string): string | null {
  const list = listing.listing_images ?? []
  const primary = list.find((i) => i.is_primary) || list[0]
  const raw = primary?.url?.trim() || primary?.thumbnail_url?.trim()
  if (raw) {
    const resolved = absoluteImageUrl(raw, origin)
    if (resolved) return resolved
  }

  const relativeOrAbsolute = listingHeroSlideSrc(listing.listing_images)
  if (!relativeOrAbsolute) return null
  return absoluteImageUrl(relativeOrAbsolute, origin)
}

function additionalImageLinks(
  listing: GoogleMerchantListingRow,
  primary: string,
  origin: string,
): string[] | undefined {
  const maxAdditional = GOOGLE_MERCHANT_MAX_ADDITIONAL_IMAGES
  const extras = orderedListingImageRaws(listing)
    .map((raw) => absoluteImageUrl(raw, origin))
    .filter((url): url is string => Boolean(url) && url !== primary)

  const unique = [...new Set(extras)]
  if (unique.length === 0) return undefined
  return unique.slice(0, maxAdditional)
}

function listingBrand(listing: GoogleMerchantListingRow): string | null {
  const brand = listing.brand?.trim()
  return brand || null
}

function listingModel(listing: GoogleMerchantListingRow): string | null {
  const model = listing.model?.trim()
  return model || null
}

function productIdentifiers(listing: GoogleMerchantListingRow): {
  brand?: string
  mpn?: string
  identifierExists: boolean
} {
  const brand = listingBrand(listing)
  const model = listingModel(listing)

  if (brand && model) {
    const mpn = model.length > MAX_MPN_LENGTH ? model.slice(0, MAX_MPN_LENGTH) : model
    return { brand, mpn, identifierExists: true }
  }

  return {
    brand: brand ?? undefined,
    identifierExists: false,
  }
}

function mapListingShippingAttributes(
  listing: GoogleMerchantListingRow,
): GoogleMerchantShipping[] | undefined {
  if (!listing.shipping_available) return undefined

  const mode = effectiveBoardShippingMode({
    board_shipping_cost_mode: listing.board_shipping_cost_mode,
    shipping_price: listing.shipping_price,
  })

  if (mode === "free") {
    return [
      {
        country: "US",
        service: "Standard",
        price: { amountMicros: "0", currencyCode: "USD" },
      },
    ]
  }

  if (mode === "flat") {
    const shipUsd = Math.max(0, Number.parseFloat(String(listing.shipping_price ?? 0)) || 0)
    return [
      {
        country: "US",
        service: "Standard",
        price: { amountMicros: priceToMicros(shipUsd), currencyCode: "USD" },
      },
    ]
  }

  const estimatedUsd = getGoogleMerchantEstimatedShippingUsd()

  return [
    {
      country: "US",
      service: "Standard",
      price: { amountMicros: priceToMicros(estimatedUsd), currencyCode: "USD" },
    },
  ]
}

function mapListingTaxAttributes(): GoogleMerchantTax[] | undefined {
  const rate = getGoogleMerchantUsTaxRate()
  if (rate == null) return undefined

  return [
    {
      country: "US",
      rate,
      taxShip: false,
    },
  ]
}

export function isGoogleMerchantEligibleListing(listing: GoogleMerchantListingRow): boolean {
  if (listing.section !== "surfboards") return false
  if (listing.status !== "active") return false
  if (listing.hidden_from_site === true) return false
  if (!listing.title?.trim()) return false
  if (!Number.isFinite(listing.price) || listing.price <= 0) return false
  const origin = publicSiteOrigin()
  if (!absoluteImageLink(listing, origin)) return false
  return true
}

export function mapListingToProductInput(
  listing: GoogleMerchantListingRow,
): GoogleMerchantProductInputPayload | null {
  if (!isGoogleMerchantEligibleListing(listing)) return null

  const origin = publicSiteOrigin()
  const imageLink = absoluteImageLink(listing, origin)
  if (!imageLink) return null

  const href = listingDetailHref(listing)
  const link = `${origin}${href}`
  const descriptionRaw = stripHtml(listing.description?.trim() || listing.title.trim())
  const description = descriptionRaw || listing.title.trim()
  const identifiers = productIdentifiers(listing)
  const shipping = mapListingShippingAttributes(listing)
  const taxes = mapListingTaxAttributes()
  const additionalImages = additionalImageLinks(listing, imageLink, origin)

  return {
    offerId: listing.id,
    contentLanguage: getGoogleMerchantContentLanguage(),
    feedLabel: getGoogleMerchantFeedLabel(),
    productAttributes: {
      title: listing.title.trim(),
      description,
      link,
      imageLink,
      ...(additionalImages ? { additionalImageLinks: additionalImages } : {}),
      availability: "IN_STOCK",
      condition: mapCondition(listing.condition),
      price: {
        amountMicros: priceToMicros(listing.price),
        currencyCode: "USD",
      },
      brand: identifiers.brand,
      mpn: identifiers.mpn,
      identifierExists: identifiers.identifierExists,
      googleProductCategory: getGoogleMerchantProductCategory(),
      ...(shipping ? { shipping } : {}),
      ...(taxes ? { taxes } : {}),
    },
  }
}
