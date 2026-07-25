import { googleMerchantProductLink } from "@/lib/google-merchant/product-link"
import {
  googleMerchantListingImageSourceUrl,
  googleMerchantListingImageUrl,
} from "@/lib/google-merchant/product-image-link"
import type { ListingImageForCard } from "@/lib/listing-image-display"
import { publicSiteOrigin } from "@/lib/public-site-origin"
import { effectiveBoardShippingMode } from "@/lib/services/peerListingShippingQuote"
import {
  GOOGLE_MERCHANT_MAX_ADDITIONAL_IMAGES,
  getGoogleMerchantContentLanguage,
  getGoogleMerchantCustomLabel0ForSection,
  getGoogleMerchantEstimatedShippingUsdForSection,
  getGoogleMerchantFeedLabel,
  getGoogleMerchantProductCategoryForSection,
  getGoogleMerchantUsTaxRate,
  isGoogleMerchantPeerSection,
} from "./config"
import { mapListingConditionToGoogleMerchant, type GoogleMerchantCondition } from "./condition"
import { buildGoogleMerchantProductDescription } from "./product-description"

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
  archived_at?: string | null
  shipping_available?: boolean | null
  shipping_price?: string | number | null
  board_shipping_cost_mode?: string | null
  board_type?: string | null
  dimensions?: string | null
  fins_setup?: string | null
  fin_system?: string | null
  fin_size?: string | null
  wetsuit_size?: string | null
  magazine_year?: number | null
  city?: string | null
  state?: string | null
  local_pickup?: boolean | null
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
    condition: GoogleMerchantCondition
    price: GoogleMerchantPrice
    brand?: string
    mpn?: string
    identifierExists: boolean
    googleProductCategory: string
    customLabel0?: string
    shipping?: GoogleMerchantShipping[]
    taxes?: GoogleMerchantTax[]
  }
}

const MAX_MPN_LENGTH = 70

function priceToMicros(amountUsd: number): string {
  return String(Math.round(amountUsd * 1_000_000))
}

function absoluteImageUrl(raw: string | null | undefined): string | null {
  return googleMerchantListingImageUrl(raw)
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
    const source = googleMerchantListingImageSourceUrl(img)
    if (source) urls.push(source)
  }
  return urls
}

function absoluteImageLink(listing: GoogleMerchantListingRow): string | null {
  const list = listing.listing_images ?? []
  const primary = list.find((i) => i.is_primary) || list[0]
  if (!primary) return null

  const raw = googleMerchantListingImageSourceUrl(primary)
  if (raw) {
    const resolved = absoluteImageUrl(raw)
    if (resolved) return resolved
  }

  for (const img of list) {
    const fallback = googleMerchantListingImageSourceUrl(img)
    if (!fallback) continue
    const resolved = absoluteImageUrl(fallback)
    if (resolved) return resolved
  }

  return null
}

function additionalImageLinks(
  listing: GoogleMerchantListingRow,
  primary: string,
): string[] | undefined {
  const maxAdditional = GOOGLE_MERCHANT_MAX_ADDITIONAL_IMAGES
  const extras = orderedListingImageRaws(listing)
    .map((raw) => absoluteImageUrl(raw))
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

  const estimatedUsd = getGoogleMerchantEstimatedShippingUsdForSection(listing.section)

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
  if (!isGoogleMerchantPeerSection(listing.section)) return false
  if (listing.status !== "active") return false
  if (listing.archived_at) return false
  if (listing.hidden_from_site === true) return false
  if (!listing.title?.trim()) return false
  if (!Number.isFinite(listing.price) || listing.price <= 0) return false
  if (!absoluteImageLink(listing)) return false
  return true
}

export function mapListingToProductInput(
  listing: GoogleMerchantListingRow,
): GoogleMerchantProductInputPayload | null {
  if (!isGoogleMerchantEligibleListing(listing)) return null

  const origin = publicSiteOrigin()
  const imageLink = absoluteImageLink(listing)
  if (!imageLink) return null

  const link = googleMerchantProductLink(listing, origin)
  const description = buildGoogleMerchantProductDescription(listing)
  const identifiers = productIdentifiers(listing)
  const shipping = mapListingShippingAttributes(listing)
  const taxes = mapListingTaxAttributes()
  const additionalImages = additionalImageLinks(listing, imageLink)
  const customLabel0 = getGoogleMerchantCustomLabel0ForSection(listing.section)

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
      condition: mapListingConditionToGoogleMerchant(listing.condition),
      price: {
        amountMicros: priceToMicros(listing.price),
        currencyCode: "USD",
      },
      brand: identifiers.brand,
      mpn: identifiers.mpn,
      identifierExists: identifiers.identifierExists,
      googleProductCategory: getGoogleMerchantProductCategoryForSection(listing.section),
      ...(customLabel0 ? { customLabel0 } : {}),
      ...(shipping ? { shipping } : {}),
      ...(taxes ? { taxes } : {}),
    },
  }
}
