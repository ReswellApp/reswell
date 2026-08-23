import {
  BRAND_REQUEST_MEDIA_PROXY_PATH_PREFIX,
  brandRequestLogosStorageObjectPathFromUrl,
  proxiedBrandRequestLogoSrc,
} from "@/lib/brand-request-media-proxy-url"
import { isOurPublicStorageMediaHost } from "@/lib/public-storage-media-host"

const PUBLIC_BRAND_ASSETS_MARKER = "/storage/v1/object/public/brand-assets/"

export const BRAND_MEDIA_PROXY_PATH_PREFIX = "/media/brands/" as const

export function isProxiedBrandMediaSrc(src: string | null | undefined): boolean {
  return typeof src === "string" && src.startsWith(BRAND_MEDIA_PROXY_PATH_PREFIX)
}

export function brandAssetsStorageObjectPathFromUrl(url: string): string | null {
  const raw = url.trim().split(/[?#]/)[0]?.trim()
  if (!raw) return null

  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return null
  }

  if (!isOurPublicStorageMediaHost(parsed.hostname)) return null

  const idx = parsed.pathname.indexOf(PUBLIC_BRAND_ASSETS_MARKER)
  if (idx === -1) return null

  try {
    const path = decodeURIComponent(parsed.pathname.slice(idx + PUBLIC_BRAND_ASSETS_MARKER.length))
    const normalized = path.replace(/^\/+/, "")
    if (!normalized || normalized.includes("..")) return null
    return normalized
  } catch {
    return null
  }
}

/** Same-origin path served by `app/media/brands/[...path]/route.ts`. */
export function proxiedBrandMediaSrc(url: string | null | undefined): string {
  if (url == null) return ""
  const t = String(url).trim()
  if (!t) return ""
  if (t.startsWith(BRAND_MEDIA_PROXY_PATH_PREFIX)) return t

  const path = brandAssetsStorageObjectPathFromUrl(t)
  if (!path) return t

  const encoded = path
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/")

  return `${BRAND_MEDIA_PROXY_PATH_PREFIX}${encoded}`
}

/** Catalog logos (`brand-assets`) and sell-flow request logos (`brand-request-logos`). */
export function brandLogoDisplaySrc(url: string | null | undefined): string {
  if (url == null) return ""
  const t = String(url).trim()
  if (!t) return ""

  const fromBrandAssets = proxiedBrandMediaSrc(t)
  if (fromBrandAssets !== t) return fromBrandAssets

  const fromRequest = proxiedBrandRequestLogoSrc(t)
  if (fromRequest !== t) return fromRequest

  // External manufacturer CDNs are not served at runtime — mirror into brand-assets first.
  return ""
}

/** True when the logo URL is stored in our Supabase buckets (or same-origin `/media/*` proxy). */
export function isSelfHostedBrandLogoUrl(url: string | null | undefined): boolean {
  return brandLogoStorageRef(url) != null
}

export type BrandLogoStorageBucket = "brand-assets" | "brand-request-logos"

export type BrandLogoStorageRef = {
  bucket: BrandLogoStorageBucket
  objectPath: string
}

function objectPathFromProxiedMediaSrc(src: string, prefix: string): string | null {
  if (!src.startsWith(prefix)) return null
  const raw = src.slice(prefix.length).split(/[?#]/)[0] ?? ""
  try {
    const decoded = raw
      .split("/")
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment))
      .join("/")
    if (!decoded || decoded.includes("..")) return null
    return decoded
  } catch {
    return null
  }
}

/** Storage object for a catalog or request logo URL (public URL or `/media/*` proxy). */
export function brandLogoStorageRef(
  logoUrl: string | null | undefined,
): BrandLogoStorageRef | null {
  const trimmed = logoUrl?.trim()
  if (!trimmed) return null

  const brandAssetsPath =
    brandAssetsStorageObjectPathFromUrl(trimmed) ??
    objectPathFromProxiedMediaSrc(trimmed, BRAND_MEDIA_PROXY_PATH_PREFIX)
  if (brandAssetsPath) return { bucket: "brand-assets", objectPath: brandAssetsPath }

  const requestPath =
    brandRequestLogosStorageObjectPathFromUrl(trimmed) ??
    objectPathFromProxiedMediaSrc(trimmed, BRAND_REQUEST_MEDIA_PROXY_PATH_PREFIX)
  if (requestPath) return { bucket: "brand-request-logos", objectPath: requestPath }

  return null
}
