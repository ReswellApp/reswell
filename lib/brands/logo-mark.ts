import { isOurPublicStorageMediaHost } from "@/lib/public-storage-media-host"

/**
 * Hosts allowlisted in `next.config.mjs` `images.remotePatterns` (exact hostnames).
 * Unlisted manufacturer CDNs throw on `<Image>` and take down `/brands`.
 */
const CONFIGURED_NEXT_IMAGE_HOSTS = new Set([
  "app.reswell.app",
  "picsum.photos",
  "cdn.shopify.com",
  "images.squarespace-cdn.com",
  "cms-web.seamuseum.net",
  "images.unsplash.com",
  "maps.googleapis.com",
  "albumsurf.com",
  "bingsurf.com",
  "cisurfboards.com",
  "d3iswawdztsslu.cloudfront.net",
  "dhdsurf.com",
  "i.vimeocdn.com",
  "i.ytimg.com",
  "ianc57.sg-host.com",
  "instafeed.nfcube.com",
  "lostsurfboards.net",
  "lovemachinesurfboards.com",
  "pyzelsurfboards.com",
  "scontent.cdninstagram.com",
  "sharpeyesurfboards.com",
  "us.jsindustries.com",
  "www.chillisurfboards.com",
  "www.haydenshapes.com",
  "www.robertssurf.com",
])

/** True when `next/image` will accept this src instead of throwing unconfigured-host. */
export function isConfiguredNextImageSrc(src: string): boolean {
  const t = src.trim()
  if (!t) return false
  if (t.startsWith("/") && !t.startsWith("//")) return true

  let url: URL
  try {
    url = new URL(t)
  } catch {
    return false
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return false

  const host = url.hostname.toLowerCase()
  if (isOurPublicStorageMediaHost(host)) {
    return url.pathname.includes("/storage/v1/object/public/")
  }
  return CONFIGURED_NEXT_IMAGE_HOSTS.has(host)
}

/** First letter, or first+last initials for multi-word names. */
export function brandMarkInitials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0)
  if (words.length === 0) return "?"
  const first = words[0]?.[0]
  if (!first) return "?"
  if (words.length === 1) return first.toUpperCase()
  const last = words[words.length - 1]?.[0]
  if (!last) return first.toUpperCase()
  return `${first}${last}`.toUpperCase()
}

/**
 * Deterministic Reswell-palette fill so logo-less brands still get a color
 * profile instead of a generic icon. Hex literals stay complete for Tailwind JIT.
 */
const FALLBACK_TONES = [
  "bg-[#355185] text-white",
  "bg-[#5574AD] text-white",
  "bg-[#7F9DD5] text-[#163060]",
  "bg-[#163060] text-white",
  "bg-[#001A4A] text-[#F9F9F2]",
] as const

export function brandMarkFallbackClassName(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return FALLBACK_TONES[hash % FALLBACK_TONES.length] ?? FALLBACK_TONES[0]
}
