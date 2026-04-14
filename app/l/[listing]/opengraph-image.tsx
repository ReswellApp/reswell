import { listingShareImageResponse, LISTING_OG_SIZE } from "@/lib/og/listing-share-image"
import { getListingOgImagePayload } from "@/lib/listing-og-data"

export const size = LISTING_OG_SIZE
export const contentType = "image/png"

export default async function Image(props: { params: Promise<{ listing: string }> }) {
  const { listing: listingParam } = await props.params
  const payload = await getListingOgImagePayload(listingParam)
  if (!payload.ok) {
    return listingShareImageResponse({
      title: "Listing on Reswell",
      line2: "Peer-to-peer surfboard marketplace",
      sold: false,
    })
  }
  return listingShareImageResponse({
    title: payload.title,
    line2: payload.line2,
    photoUrl: payload.photoUrl,
    sold: payload.sold,
  })
}
