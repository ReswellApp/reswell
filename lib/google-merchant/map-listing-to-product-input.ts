import { listingDetailHref } from "@/lib/listing-href"
import { listingHeroSlideSrc, type ListingImageForCard } from "@/lib/listing-image-display"
import { publicSiteOrigin } from "@/lib/public-site-origin"
import {
  getGoogleMerchantContentLanguage,
  getGoogleMerchantFeedLabel,
  getGoogleMerchantProductCategory,
} from "./config"

export type GoogleMerchantListingRow = {
  id: string
  slug: string | null
  title: string
  description: string | null
  price: number
  condition: string | null
  brand: string | null
  section: string
  status: string
  hidden_from_site?: boolean | null
  listing_images?: ListingImageForCard[] | null
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
    availability: "IN_STOCK" | "OUT_OF_STOCK"
    condition: "NEW" | "USED"
    price: {
      amountMicros: string
      currencyCode: "USD"
    }
    brand?: string
    identifierExists: boolean
    googleProductCategory: string
  }
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

function mapCondition(condition: string | null | undefined): "NEW" | "USED" {
  const value = (condition ?? "").trim()
  return value === "brand_new" || value === "new" ? "NEW" : "USED"
}

function absoluteImageLink(listing: GoogleMerchantListingRow, origin: string): string | null {
  const relativeOrAbsolute = listingHeroSlideSrc(listing.listing_images)
  if (!relativeOrAbsolute) return null
  if (/^https?:\/\//i.test(relativeOrAbsolute)) return relativeOrAbsolute
  return `${origin}${relativeOrAbsolute.startsWith("/") ? "" : "/"}${relativeOrAbsolute}`
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

  return {
    offerId: listing.id,
    contentLanguage: getGoogleMerchantContentLanguage(),
    feedLabel: getGoogleMerchantFeedLabel(),
    productAttributes: {
      title: listing.title.trim(),
      description,
      link,
      imageLink,
      availability: "IN_STOCK",
      condition: mapCondition(listing.condition),
      price: {
        amountMicros: String(Math.round(listing.price * 1_000_000)),
        currencyCode: "USD",
      },
      brand: listing.brand?.trim() || undefined,
      identifierExists: false,
      googleProductCategory: getGoogleMerchantProductCategory(),
    },
  }
}
