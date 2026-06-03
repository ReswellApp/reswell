import { isOurPublicStorageMediaHost } from "@/lib/public-storage-media-host"

const PUBLIC_SEO_ASSETS_MARKER = "/storage/v1/object/public/seo-assets/"

export const SEO_MEDIA_PROXY_PATH_PREFIX = "/media/seo/" as const

export function isProxiedSeoMediaSrc(src: string | null | undefined): boolean {
  return typeof src === "string" && src.startsWith(SEO_MEDIA_PROXY_PATH_PREFIX)
}

export function seoAssetsStorageObjectPathFromUrl(url: string): string | null {
  const raw = url.trim().split(/[?#]/)[0]?.trim()
  if (!raw) return null

  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return null
  }

  if (!isOurPublicStorageMediaHost(parsed.hostname)) return null

  const idx = parsed.pathname.indexOf(PUBLIC_SEO_ASSETS_MARKER)
  if (idx === -1) return null

  try {
    const path = decodeURIComponent(parsed.pathname.slice(idx + PUBLIC_SEO_ASSETS_MARKER.length))
    const normalized = path.replace(/^\/+/, "")
    if (!normalized || normalized.includes("..")) return null
    return normalized
  } catch {
    return null
  }
}

/** Same-origin path served by `app/media/seo/[...path]/route.ts`. */
export function proxiedSeoMediaSrc(url: string | null | undefined): string {
  if (url == null) return ""
  const t = String(url).trim()
  if (!t) return ""
  if (t.startsWith(SEO_MEDIA_PROXY_PATH_PREFIX)) return t

  const path = seoAssetsStorageObjectPathFromUrl(t)
  if (!path) return t

  const encoded = path
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/")

  return `${SEO_MEDIA_PROXY_PATH_PREFIX}${encoded}`
}

/** Favicons, Apple touch icons, and admin OG share images in `seo-assets`. */
export function seoMediaDisplaySrc(url: string | null | undefined): string {
  return proxiedSeoMediaSrc(url)
}
