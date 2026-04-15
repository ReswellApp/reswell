import { listingShareImageResponse } from "@/lib/og/listing-share-image"
import { brandShareImageResponse } from "@/lib/og/brand-share-image"
import { getBoardsBrowseOgPayload } from "@/lib/boards-og-data"

export const runtime = "nodejs"

/** Refresh share art so category pages pick up newly listed boards. */
export const revalidate = 120

export async function GET(request: Request) {
  const type = new URL(request.url).searchParams.get("type")?.trim() || undefined
  const payload = await getBoardsBrowseOgPayload(type)

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
