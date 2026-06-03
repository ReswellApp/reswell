import { isOurPublicStorageMediaHost } from "@/lib/public-storage-media-host"

const PUBLIC_SURFER_ASSETS_MARKER = "/storage/v1/object/public/surfer-assets/"

export const SURFER_MEDIA_PROXY_PATH_PREFIX = "/media/surfers/" as const

export function isProxiedSurferMediaSrc(src: string | null | undefined): boolean {
  return typeof src === "string" && src.startsWith(SURFER_MEDIA_PROXY_PATH_PREFIX)
}

export function surferAssetsStorageObjectPathFromUrl(url: string): string | null {
  const raw = url.trim().split(/[?#]/)[0]?.trim()
  if (!raw) return null

  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return null
  }

  if (!isOurPublicStorageMediaHost(parsed.hostname)) return null

  const idx = parsed.pathname.indexOf(PUBLIC_SURFER_ASSETS_MARKER)
  if (idx === -1) return null

  try {
    const path = decodeURIComponent(parsed.pathname.slice(idx + PUBLIC_SURFER_ASSETS_MARKER.length))
    const normalized = path.replace(/^\/+/, "")
    if (!normalized || normalized.includes("..")) return null
    return normalized
  } catch {
    return null
  }
}

/** Same-origin path served by `app/media/surfers/[...path]/route.ts`. */
export function proxiedSurferMediaSrc(url: string | null | undefined): string {
  if (url == null) return ""
  const t = String(url).trim()
  if (!t) return ""
  if (t.startsWith(SURFER_MEDIA_PROXY_PATH_PREFIX)) return t

  const path = surferAssetsStorageObjectPathFromUrl(t)
  if (!path) return t

  const encoded = path
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/")

  return `${SURFER_MEDIA_PROXY_PATH_PREFIX}${encoded}`
}

/** Surfer profile photos and quiver gallery images. */
export function surferMediaDisplaySrc(url: string | null | undefined): string {
  return proxiedSurferMediaSrc(url)
}
