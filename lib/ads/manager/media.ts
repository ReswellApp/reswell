export const MAX_IMAGE_BYTES = 4_000_000
export const MAX_VIDEO_BYTES = 100_000_000
export const VIDEO_CHUNK_BYTES = 2_000_000

const GOOGLE_IMAGE_MIME = {
  "image/jpeg": "IMAGE_JPEG",
  "image/png": "IMAGE_PNG",
  "image/gif": "IMAGE_GIF",
} as const

export type GoogleImageMime = (typeof GOOGLE_IMAGE_MIME)[keyof typeof GOOGLE_IMAGE_MIME]

export function googleImageMime(mime: string): GoogleImageMime | null {
  const normalized = mime.trim().toLowerCase()
  return GOOGLE_IMAGE_MIME[normalized as keyof typeof GOOGLE_IMAGE_MIME] ?? null
}

export function isMetaImageMime(mime: string): boolean {
  return ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mime.trim().toLowerCase())
}

export function isMetaVideoMime(mime: string): boolean {
  return ["video/mp4", "video/quicktime"].includes(mime.trim().toLowerCase())
}

export function safeMediaName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? ""
  const cleaned = base.replace(/[^\w.\- ]+/g, "").replace(/^\.+/, "").trim().slice(0, 80)
  return cleaned || "upload"
}

export function pmaxTextLimit(field: string): number | null {
  switch (field) {
    case "HEADLINE":
      return 30
    case "LONG_HEADLINE":
    case "DESCRIPTION":
      return 90
    case "BUSINESS_NAME":
      return 25
    default:
      return null
  }
}

export function googleAssetOwnedBy(customerId: string, resource: string): boolean {
  if (!/^\d{10}$/.test(customerId)) return false
  return new RegExp(`^customers/${customerId}/assets/\\d+$`).test(resource)
}

export function pmaxLinkOwnedBy(customerId: string, link: string): boolean {
  if (!/^\d{10}$/.test(customerId)) return false
  return new RegExp(`^customers/${customerId}/assetGroupAssets/\\d+~\\d+~[A-Z0-9_]+$`).test(link)
}

export function parseYoutubeId(raw: string): string | null {
  const trimmed = raw.trim()
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed
  try {
    const url = new URL(trimmed)
    const host = url.hostname.replace(/^www\./, "")
    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0] ?? ""
      return /^[\w-]{11}$/.test(id) ? id : null
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      const watch = url.searchParams.get("v")
      if (watch && /^[\w-]{11}$/.test(watch)) return watch
      const nested = url.pathname.match(/^\/(?:shorts|embed)\/([\w-]{11})/)
      if (nested) return nested[1]
    }
  } catch {
    return null
  }
  return null
}
