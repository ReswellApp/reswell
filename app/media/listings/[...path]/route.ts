import { NextResponse } from "next/server"
import { evaluateListingMediaAccess } from "@/lib/listing-media-crawler-guard"
import { isValidListingMediaObjectPath } from "@/lib/listing-media-proxy-path-validation"
import { cachedPublicStorageGetResponse } from "@/lib/media/cached-public-storage-get-response"

const PUBLIC_LISTINGS_MARKER = "/storage/v1/object/public/listings/"

function contentTypeFallback(filename: string): string {
  const lower = filename.toLowerCase()
  if (lower.endsWith(".webp")) return "image/webp"
  return "image/jpeg"
}

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
  if (!isValidListingMediaObjectPath(path)) {
    return new NextResponse("Not found", { status: 404 })
  }

  return cachedPublicStorageGetResponse({
    bucket: "listings",
    objectPath: path,
    publicMarker: PUBLIC_LISTINGS_MARKER,
    contentTypeFallback,
  })
}
