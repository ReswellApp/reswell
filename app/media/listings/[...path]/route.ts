import { NextResponse } from "next/server"
import { evaluateListingMediaAccess } from "@/lib/listing-media-crawler-guard"
import { isValidListingMediaObjectPath } from "@/lib/listing-media-proxy-path-validation"
import { LISTING_MEDIA_TILE_VARIANT_PARAM } from "@/lib/listing-media-proxy-url"
import { cachedPublicStorageGetResponse } from "@/lib/media/cached-public-storage-get-response"
import {
  getCachedListingTileVariantBody,
  listingMediaPathLooksLikeStoredThumb,
} from "@/lib/media/listing-tile-variant-resize"
import { PUBLIC_MEDIA_CACHE_CONTROL } from "@/lib/listing-media-cache-control"

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

  const variant = new URL(request.url).searchParams.get("variant")
  const wantsTileVariant = variant === LISTING_MEDIA_TILE_VARIANT_PARAM

  if (!wantsTileVariant || listingMediaPathLooksLikeStoredThumb(path)) {
    return cachedPublicStorageGetResponse({
      bucket: "listings",
      objectPath: path,
      publicMarker: PUBLIC_LISTINGS_MARKER,
      contentTypeFallback,
    })
  }

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "")
  if (!base) {
    return new NextResponse("Server misconfiguration", { status: 500 })
  }

  const encodedPath = path
    .split("/")
    .map((p) => encodeURIComponent(p))
    .join("/")
  const upstreamUrl = `${base}${PUBLIC_LISTINGS_MARKER}${encodedPath}`

  const tileVariant = await getCachedListingTileVariantBody("listings", path, upstreamUrl)
  if (!tileVariant) {
    return new NextResponse("Not found", { status: 404 })
  }

  return new NextResponse(new Uint8Array(tileVariant.body), {
    status: 200,
    headers: {
      "Content-Type": tileVariant.contentType,
      "Cache-Control": PUBLIC_MEDIA_CACHE_CONTROL,
    },
  })
}
