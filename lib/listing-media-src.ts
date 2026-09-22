/**
 * Listing photo URL helpers with no Next/runtime deps so node:test can import them.
 * App code can keep importing the same names from `@/lib/listing-media-proxy-url`.
 */

/** Same-origin listing photo proxy — see `app/media/listings/[...path]/route.ts`. */
export const LISTING_MEDIA_PROXY_PATH_PREFIX = "/media/listings/" as const

/**
 * Resize hint for marketplace tiles (≤1280px long edge WebP).
 * `tile2` busts the year-long immutable cache on the old 640px `?variant=tile` URLs.
 */
export const LISTING_MEDIA_TILE_VARIANT_PARAM = "tile2" as const
/** Previous 640px tile generation — still accepted by `/media/listings`. */
export const LISTING_MEDIA_TILE_VARIANT_PARAM_LEGACY = "tile" as const

const PUBLIC_LISTINGS_MARKER = "/storage/v1/object/public/listings/"

function isOurListingStorageHost(hostname: string): boolean {
  return hostname === "app.reswell.app" || hostname.endsWith(".supabase.co")
}

/**
 * Returns the object path inside the `listings` bucket (e.g. `userId/file.webp`)
 * when `url` is a known Supabase (or app.reswell.app) public listing object URL.
 */
export function listingStorageObjectPathFromUrl(url: string): string | null {
  const s = url.trim()
  if (!s) return null
  let parsed: URL
  try {
    parsed = new URL(s)
  } catch {
    return null
  }
  if (!isOurListingStorageHost(parsed.hostname)) return null
  const idx = parsed.pathname.indexOf(PUBLIC_LISTINGS_MARKER)
  if (idx === -1) return null
  const path = parsed.pathname.slice(idx + PUBLIC_LISTINGS_MARKER.length)
  if (!path || path.includes("..")) return null
  return path
}

/**
 * Same-origin path served by `app/media/listings/[...path]/route.ts` so listing photos
 * use `reswell.app/media/listings/...` instead of exposing the Supabase project host.
 */
export function proxiedListingImageSrc(url: string | null | undefined): string {
  if (url == null) return ""
  const t = String(url).trim()
  if (!t) return ""
  const path = listingStorageObjectPathFromUrl(t)
  if (!path) return t
  return `${LISTING_MEDIA_PROXY_PATH_PREFIX}${path}`
}

export function withListingMediaVariant(src: string, variant: string): string {
  const t = src.trim()
  if (!t || !t.startsWith(LISTING_MEDIA_PROXY_PATH_PREFIX)) return t
  if (t.includes("variant=")) return t
  const sep = t.includes("?") ? "&" : "?"
  return `${t}${sep}variant=${variant}`
}

/** Appends `?variant=tile2` so `/media/listings` can serve a cached ≤1280px WebP for browse grids. */
export function withListingMediaTileVariant(src: string): string {
  return withListingMediaVariant(src, LISTING_MEDIA_TILE_VARIANT_PARAM)
}

/** On-demand fallback when a listing has no stored card/film object yet. */
export const LISTING_MEDIA_CARD_VARIANT_PARAM = "card" as const
export const LISTING_MEDIA_FILM_VARIANT_PARAM = "film" as const

/**
 * Filename token for the stored derivative. `2` busts the immutable cache of the
 * first generation (480px cards / 200px film, which looked soft on retina).
 */
const LISTING_DERIVATIVE_FILE_TOKEN = {
  card: "card2",
  film: "film2",
} as const

/**
 * Stored sibling of a `*-full.*` upload (`*-card2.webp`, `*-film2.webp`).
 * Returns null when the URL is not a paired full object.
 */
export function listingStoredDerivativeUrl(
  url: string | null | undefined,
  kind: "card" | "film",
): string | null {
  const full = listingFullImageUrlFromRef(url)
  if (!full || !full.includes("-full.")) return null
  return full.replace("-full.", `-${LISTING_DERIVATIVE_FILE_TOKEN[kind]}.`)
}

/** Same-origin URL for a stored card/film file, or `?variant=` when the name cannot be derived. */
export function listingDerivativeProxySrc(
  full: string,
  kind: "card" | "film",
): string {
  const derived = listingStoredDerivativeUrl(full, kind)
  if (derived) {
    const proxied = proxiedListingImageSrc(derived)
    if (proxied.startsWith(LISTING_MEDIA_PROXY_PATH_PREFIX)) return proxied
  }
  const proxiedFull = proxiedListingImageSrc(full)
  if (proxiedFull.startsWith(LISTING_MEDIA_PROXY_PATH_PREFIX)) {
    const variant =
      kind === "card" ? LISTING_MEDIA_CARD_VARIANT_PARAM : LISTING_MEDIA_FILM_VARIANT_PARAM
    return withListingMediaVariant(proxiedFull, variant)
  }
  return proxiedFull || full
}

/**
 * Prefer the full-res storage object when a row only has a `-thumb.` URL.
 * Pair uploads store `*-full.*` beside `*-thumb.webp`.
 */
export function listingFullImageUrlFromRef(url: string | null | undefined): string | null {
  const t = url?.trim()
  if (!t) return null
  if (t.includes("-thumb.")) return t.replace("-thumb.", "-full.")
  return t
}
