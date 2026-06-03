import { NextResponse } from "next/server"
import { cachedPublicStorageGetResponse } from "@/lib/media/cached-public-storage-get-response"
import { isValidSurferAssetsObjectPath } from "@/lib/surfer-media-proxy-path-validation"

const PUBLIC_SURFER_ASSETS_MARKER = "/storage/v1/object/public/surfer-assets/"

function contentTypeFallback(): string {
  return "image/webp"
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
  if (!isValidSurferAssetsObjectPath(path)) {
    return new NextResponse("Not found", { status: 404 })
  }

  return cachedPublicStorageGetResponse({
    bucket: "surfer-assets",
    objectPath: path,
    publicMarker: PUBLIC_SURFER_ASSETS_MARKER,
    contentTypeFallback,
  })
}
