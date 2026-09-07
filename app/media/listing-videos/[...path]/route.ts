import { NextResponse } from "next/server"
import { evaluateListingMediaAccess } from "@/lib/listing-media-crawler-guard"
import { isValidListingVideoObjectPath } from "@/lib/listing-media-proxy-path-validation"
import { listingVideoStreamResponse } from "@/lib/media/listing-video-stream-response"

export async function GET(
  request: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const access = evaluateListingMediaAccess(request)
  if (!access.allowed) {
    return new NextResponse(access.message, {
      status: access.status,
      headers: { "Cache-Control": "no-store" },
    })
  }

  const { path: segments } = await ctx.params
  if (!segments?.length) {
    return new NextResponse("Not found", { status: 404 })
  }
  const path = segments.map((s) => decodeURIComponent(s)).join("/")
  if (!isValidListingVideoObjectPath(path)) {
    return new NextResponse("Not found", { status: 404 })
  }

  return listingVideoStreamResponse({ request, objectPath: path })
}
