import { isOurPublicStorageMediaHost } from "@/lib/public-storage-media-host"

const PUBLIC_BRAND_REQUEST_LOGOS_MARKER = "/storage/v1/object/public/brand-request-logos/"

export const BRAND_REQUEST_MEDIA_PROXY_PATH_PREFIX = "/media/brand-requests/" as const

export function isProxiedBrandRequestMediaSrc(src: string | null | undefined): boolean {
  return typeof src === "string" && src.startsWith(BRAND_REQUEST_MEDIA_PROXY_PATH_PREFIX)
}

export function brandRequestLogosStorageObjectPathFromUrl(url: string): string | null {
  const raw = url.trim().split(/[?#]/)[0]?.trim()
  if (!raw) return null

  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return null
  }

  if (!isOurPublicStorageMediaHost(parsed.hostname)) return null

  const idx = parsed.pathname.indexOf(PUBLIC_BRAND_REQUEST_LOGOS_MARKER)
  if (idx === -1) return null

  try {
    const path = decodeURIComponent(parsed.pathname.slice(idx + PUBLIC_BRAND_REQUEST_LOGOS_MARKER.length))
    const normalized = path.replace(/^\/+/, "")
    if (!normalized || normalized.includes("..")) return null
    return normalized
  } catch {
    return null
  }
}

/** Same-origin path served by `app/media/brand-requests/[...path]/route.ts`. */
export function proxiedBrandRequestLogoSrc(url: string | null | undefined): string {
  if (url == null) return ""
  const t = String(url).trim()
  if (!t) return ""
  if (t.startsWith(BRAND_REQUEST_MEDIA_PROXY_PATH_PREFIX)) return t

  const path = brandRequestLogosStorageObjectPathFromUrl(t)
  if (!path) return t

  const encoded = path
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/")

  return `${BRAND_REQUEST_MEDIA_PROXY_PATH_PREFIX}${encoded}`
}
