import { NextResponse } from "next/server"
import { evaluateListingMediaAccess } from "@/lib/listing-media-crawler-guard"
import { isValidListingMediaObjectPath } from "@/lib/listing-media-proxy-path-validation"
import {
  LISTING_MEDIA_CARD_VARIANT_PARAM,
  LISTING_MEDIA_FILM_VARIANT_PARAM,
  LISTING_MEDIA_MERCHANT_VARIANT_PARAM,
  LISTING_MEDIA_PDP_VARIANT_PARAM,
  LISTING_MEDIA_TILE_VARIANT_PARAM,
  LISTING_MEDIA_TILE_VARIANT_PARAM_LEGACY,
} from "@/lib/listing-media-proxy-url"
import { cachedPublicStorageGetResponse } from "@/lib/media/cached-public-storage-get-response"
import { getCachedPublicStorageObject, cachedPublicStorageObjectBody } from "@/lib/cache/public-storage-object"
import {
  getCachedListingVariantBody,
  LISTING_MEDIA_CARD_VARIANT,
  LISTING_MEDIA_FILM_VARIANT,
  LISTING_MEDIA_MERCHANT_VARIANT,
  LISTING_MEDIA_PDP_VARIANT,
  LISTING_MEDIA_TILE_VARIANT,
  listingMediaPathLooksLikeStoredThumb,
  listingFullObjectPathFromDerivative,
  listingMediaStoredDerivativeKind,
  type ListingMediaResizeVariant,
} from "@/lib/media/listing-tile-variant-resize"
import { PUBLIC_MEDIA_CACHE_CONTROL } from "@/lib/listing-media-cache-control"

const PUBLIC_LISTINGS_MARKER = "/storage/v1/object/public/listings/"

function listingsUpstreamUrl(objectPath: string): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "")
  if (!base) return null
  const encodedPath = objectPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")
  return `${base}${PUBLIC_LISTINGS_MARKER}${encodedPath}`
}

function storedObjectResponse(
  objectPath: string,
  body: Buffer,
  contentType: string,
): NextResponse {
  const fileSeg = objectPath.split("/").pop() ?? ""
  const type =
    contentType !== "application/octet-stream" ? contentType : contentTypeFallback(fileSeg)
  return new NextResponse(new Uint8Array(body), {
    status: 200,
    headers: {
      "Content-Type": type,
      "Cache-Control": PUBLIC_MEDIA_CACHE_CONTROL,
    },
  })
}

async function resizedListingResponse(
  objectPath: string,
  variant: ListingMediaResizeVariant,
): Promise<NextResponse> {
  const upstreamUrl = listingsUpstreamUrl(objectPath)
  if (!upstreamUrl) {
    return new NextResponse("Server misconfiguration", { status: 500 })
  }
  const resized = await getCachedListingVariantBody("listings", objectPath, upstreamUrl, variant)
  if (!resized) return new NextResponse("Not found", { status: 404 })
  return storedObjectResponse(objectPath, resized.body, resized.contentType)
}

function contentTypeFallback(filename: string): string {
  const lower = filename.toLowerCase()
  if (lower.endsWith(".webp")) return "image/webp"
  if (lower.endsWith(".mp4")) return "video/mp4"
  if (lower.endsWith(".mov")) return "video/quicktime"
  if (lower.endsWith(".webm")) return "video/webm"
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

  const storedDerivative = listingMediaStoredDerivativeKind(path)
  if (storedDerivative) {
    const upstreamUrl = listingsUpstreamUrl(path)
    if (!upstreamUrl) {
      return new NextResponse("Server misconfiguration", { status: 500 })
    }
    const stored = await getCachedPublicStorageObject("listings", path, upstreamUrl)
    if (stored) {
      return storedObjectResponse(path, cachedPublicStorageObjectBody(stored), stored.contentType)
    }
    const fullPath = listingFullObjectPathFromDerivative(path)
    return resizedListingResponse(
      fullPath,
      storedDerivative === "card" ? LISTING_MEDIA_CARD_VARIANT : LISTING_MEDIA_FILM_VARIANT,
    )
  }

  const variantParam = new URL(request.url).searchParams.get("variant")
  const resizeVariant: ListingMediaResizeVariant | null =
    variantParam === LISTING_MEDIA_TILE_VARIANT_PARAM ||
    variantParam === LISTING_MEDIA_TILE_VARIANT_PARAM_LEGACY
      ? LISTING_MEDIA_TILE_VARIANT
      : variantParam === LISTING_MEDIA_PDP_VARIANT_PARAM
        ? LISTING_MEDIA_PDP_VARIANT
        : variantParam === LISTING_MEDIA_CARD_VARIANT_PARAM
          ? LISTING_MEDIA_CARD_VARIANT
          : variantParam === LISTING_MEDIA_FILM_VARIANT_PARAM
            ? LISTING_MEDIA_FILM_VARIANT
            : variantParam === LISTING_MEDIA_MERCHANT_VARIANT_PARAM
              ? LISTING_MEDIA_MERCHANT_VARIANT
              : null

  const resizeFromFullObject =
    resizeVariant === LISTING_MEDIA_MERCHANT_VARIANT ||
    resizeVariant === LISTING_MEDIA_CARD_VARIANT ||
    resizeVariant === LISTING_MEDIA_FILM_VARIANT
  const objectPath =
    resizeFromFullObject && listingMediaPathLooksLikeStoredThumb(path)
      ? path.replace(/-thumb\./, "-full.")
      : path

  // Stored thumbs (≤640px) stay as-is for compact rows. Card and film sizes come from the full object.
  const serveStoredThumbWithoutResize =
    listingMediaPathLooksLikeStoredThumb(objectPath) && !resizeFromFullObject

  if (!resizeVariant || serveStoredThumbWithoutResize) {
    return cachedPublicStorageGetResponse({
      bucket: "listings",
      objectPath,
      publicMarker: PUBLIC_LISTINGS_MARKER,
      contentTypeFallback,
    })
  }

  return resizedListingResponse(objectPath, resizeVariant)
}
