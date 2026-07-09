import { proxiedAvatarMediaSrc } from "@/lib/avatar-media-proxy-url"
import { brandLogoDisplaySrc, proxiedBrandMediaSrc } from "@/lib/brand-media-proxy-url"
import { seoMediaDisplaySrc } from "@/lib/seo-media-proxy-url"
import { absoluteUrl } from "@/lib/site-metadata"

/**
 * Profile photos, shop banners, and shop logos stored in `avatars` or `brand-assets`.
 * OAuth / external URLs are returned unchanged.
 */
export function profileMediaDisplaySrc(url: string | null | undefined): string {
  if (url == null) return ""
  const t = String(url).trim()
  if (!t) return ""

  const fromAvatars = proxiedAvatarMediaSrc(t)
  if (fromAvatars !== t) return fromAvatars

  return proxiedBrandMediaSrc(t)
}

export function absoluteProxiedProfileMediaUrl(
  url: string | null | undefined,
): string | undefined {
  const proxied = profileMediaDisplaySrc(url)
  if (!proxied.trim()) return undefined
  if (/^https?:\/\//i.test(proxied)) return proxied
  return absoluteUrl(proxied)
}

export { brandLogoDisplaySrc, seoMediaDisplaySrc }

export function absoluteProxiedSeoMediaUrl(
  url: string | null | undefined,
): string | undefined {
  if (url == null) return undefined
  const t = String(url).trim()
  if (!t) return undefined

  const proxied = seoMediaDisplaySrc(t)
  if (proxied !== t) {
    return /^https?:\/\//i.test(proxied) ? proxied : absoluteUrl(proxied)
  }

  return t
}

/** OG/Twitter image URLs: proxy `seo-assets`, absolutize site paths, pass through external URLs. */
export function metadataShareImageUrl(url: string | null | undefined): string {
  if (url == null) return ""
  const t = String(url).trim()
  if (!t) return ""

  const proxied = seoMediaDisplaySrc(t)
  if (proxied !== t) {
    return /^https?:\/\//i.test(proxied) ? proxied : absoluteUrl(proxied)
  }

  if (t.startsWith("/")) return absoluteUrl(t)
  return t
}

export function absoluteProxiedBrandLogoUrl(
  url: string | null | undefined,
): string | undefined {
  const proxied = brandLogoDisplaySrc(url)
  if (!proxied.trim()) return undefined
  if (/^https?:\/\//i.test(proxied)) return proxied
  return absoluteUrl(proxied)
}
