import { NextResponse } from "next/server"
import { isValidBrandAssetsObjectPath } from "@/lib/brand-media-proxy-path-validation"
import { cachedPublicStorageGetResponse } from "@/lib/media/cached-public-storage-get-response"

const PUBLIC_BRAND_ASSETS_MARKER = "/storage/v1/object/public/brand-assets/"

function contentTypeFallback(filename: string): string {
  const lower = filename.toLowerCase()
  if (lower.endsWith(".webp")) return "image/webp"
  if (lower.endsWith(".png")) return "image/png"
  if (lower.endsWith(".gif")) return "image/gif"
  if (lower.endsWith(".svg")) return "image/svg+xml"
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
  if (!isValidBrandAssetsObjectPath(path)) {
    return new NextResponse("Not found", { status: 404 })
  }

  return cachedPublicStorageGetResponse({
    bucket: "brand-assets",
    objectPath: path,
    publicMarker: PUBLIC_BRAND_ASSETS_MARKER,
    contentTypeFallback,
  })
}
