import { JsonLd } from "@/components/seo/json-ld"
import { googleMerchantListingProductSchema } from "@/lib/google-merchant/listing-product-schema"
import type { GoogleMerchantListingRow } from "@/lib/google-merchant/map-listing-to-product-input"

type ListingPdpProductJsonLdProps = {
  listing: Pick<
    GoogleMerchantListingRow,
    | "id"
    | "slug"
    | "title"
    | "description"
    | "price"
    | "brand"
    | "condition"
    | "status"
    | "listing_images"
  >
}

/** Product structured data — keeps Merchant `condition` aligned with the landing page. */
export function ListingPdpProductJsonLd({ listing }: ListingPdpProductJsonLdProps) {
  const schema = googleMerchantListingProductSchema(listing)
  if (!schema) return null
  return <JsonLd data={schema} />
}
