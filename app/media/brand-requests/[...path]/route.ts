import { NextResponse } from "next/server"
import { isValidBrandRequestLogosObjectPath } from "@/lib/brand-request-media-proxy-path-validation"
import { cachedPublicStorageGetResponse } from "@/lib/media/cached-public-storage-get-response"

const PUBLIC_BRAND_REQUEST_LOGOS_MARKER = "/storage/v1/object/public/brand-request-logos/"

function contentTypeFallback(filename: string): string {
  const lower = filename.toLowerCase()
  if (lower.endsWith(".webp")) return "image/webp"
  if (lower.endsWith(".png")) return "image/png"
  if (lower.endsWith(".gif")) return "image/gif"
  return "image/jpeg"
}

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await ctx.params
  if (!segments?.length) {
    return new NextResponse("Not found", { status: 404 })
  }
  const path = segments.map((s) => decodeURIComponent(s)).join("/")
  if (!isValidBrandRequestLogosObjectPath(path)) {
    return new NextResponse("Not found", { status: 404 })
  }

  return cachedPublicStorageGetResponse({
    bucket: "brand-request-logos",
    objectPath: path,
    publicMarker: PUBLIC_BRAND_REQUEST_LOGOS_MARKER,
    contentTypeFallback,
  })
}
