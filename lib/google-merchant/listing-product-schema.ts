import { capitalizeWords } from "@/lib/listing-labels"
import {
  googleMerchantListingImageSourceUrl,
  googleMerchantListingImageUrl,
} from "@/lib/google-merchant/product-image-link"
import { googleMerchantProductLink } from "@/lib/google-merchant/product-link"
import { buildGoogleMerchantProductDescription } from "@/lib/google-merchant/product-description"
import { mapListingConditionToSchemaOrg } from "@/lib/google-merchant/condition"
import { productSchema } from "@/lib/seo/structured-data"
import type { GoogleMerchantListingRow } from "@/lib/google-merchant/map-listing-to-product-input"

type ListingProductSchemaInput = Pick<
  GoogleMerchantListingRow,
  | "id"
  | "slug"
  | "title"
  | "description"
  | "price"
  | "brand"
  | "condition"
  | "status"
  | "section"
  | "board_type"
  | "dimensions"
  | "fins_setup"
  | "fin_system"
  | "fin_size"
  | "wetsuit_size"
  | "apparel_kind"
  | "apparel_size"
  | "magazine_year"
  | "city"
  | "state"
  | "local_pickup"
  | "shipping_available"
  | "shipping_price"
  | "board_shipping_cost_mode"
  | "listing_images"
>

function listingAvailability(
  status: string | null | undefined,
): "InStock" | "OutOfStock" | "SoldOut" {
  const value = (status ?? "").trim().toLowerCase()
  if (value === "sold") return "SoldOut"
  if (value === "active" || value === "pending_sale") return "InStock"
  return "OutOfStock"
}

/** Product JSON-LD aligned with Merchant Center `condition` + offer fields. */
export function googleMerchantListingProductSchema(listing: ListingProductSchemaInput) {
  const title = listing.title?.trim()
  if (!title) return null

  const price = Number(listing.price)
  if (!Number.isFinite(price) || price <= 0) return null

  const images = listing.listing_images ?? []
  const primary = images.find((i) => i.is_primary) || images[0]
  const imageRaw = primary ? googleMerchantListingImageSourceUrl(primary) : null
  const image = imageRaw ? googleMerchantListingImageUrl(imageRaw) : undefined

  return productSchema({
    name: capitalizeWords(title),
    description: buildGoogleMerchantProductDescription(listing),
    image,
    brand: listing.brand?.trim() || undefined,
    sku: listing.id,
    url: googleMerchantProductLink(listing),
    price,
    priceCurrency: "USD",
    availability: listingAvailability(listing.status),
    condition: mapListingConditionToSchemaOrg(listing.condition),
  })
}
