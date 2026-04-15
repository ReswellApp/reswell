import { getBoardsBrowseOgPayload } from "@/lib/boards-og-data"
import { brandShareImageResponse, BRAND_OG_SIZE } from "@/lib/og/brand-share-image"
import { listingShareImageResponse } from "@/lib/og/listing-share-image"

export const runtime = "nodejs"

export const size = BRAND_OG_SIZE
export const contentType = "image/png"

export default async function Image(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params
  if (slug === "boards") {
    const payload = await getBoardsBrowseOgPayload(undefined)
    if (payload.ok) {
      return await listingShareImageResponse({
        title: payload.title,
        line2: payload.line2,
        photoUrl: payload.photoUrl,
        sold: false,
      })
    }
    return brandShareImageResponse({
      headline: "Surfboards for sale",
      subhead: "Browse used and new boards from local sellers — shortboards, longboards, grovelers, and more.",
      footer: "reswell.app · Boards",
      tone: "light",
    })
  }
  return brandShareImageResponse({
    headline: "Reswell",
    subhead: "Buy & sell surfboards on the peer-to-peer marketplace.",
    footer: "reswell.app",
    tone: "light",
  })
}
