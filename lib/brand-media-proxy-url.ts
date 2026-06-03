import { proxiedBrandRequestLogoSrc } from "@/lib/brand-request-media-proxy-url"
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

  return proxiedBrandRequestLogoSrc(t)
}
