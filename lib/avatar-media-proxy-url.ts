import { isOurPublicStorageMediaHost } from "@/lib/public-storage-media-host"

const PUBLIC_AVATARS_MARKER = "/storage/v1/object/public/avatars/"

export const AVATAR_MEDIA_PROXY_PATH_PREFIX = "/media/avatars/" as const

export function isProxiedAvatarMediaSrc(src: string | null | undefined): boolean {
  return typeof src === "string" && src.startsWith(AVATAR_MEDIA_PROXY_PATH_PREFIX)
}

export function avatarsStorageObjectPathFromUrl(url: string): string | null {
  const raw = url.trim().split(/[?#]/)[0]?.trim()
  if (!raw) return null

  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return null
  }

  if (!isOurPublicStorageMediaHost(parsed.hostname)) return null

  const idx = parsed.pathname.indexOf(PUBLIC_AVATARS_MARKER)
  if (idx === -1) return null

  try {
    const path = decodeURIComponent(parsed.pathname.slice(idx + PUBLIC_AVATARS_MARKER.length))
    const normalized = path.replace(/^\/+/, "")
    if (!normalized || normalized.includes("..")) return null
    return normalized
  } catch {
    return null
  }
}

/** Same-origin path served by `app/media/avatars/[...path]/route.ts`. */
export function proxiedAvatarMediaSrc(url: string | null | undefined): string {
  if (url == null) return ""
  const t = String(url).trim()
  if (!t) return ""
  if (t.startsWith(AVATAR_MEDIA_PROXY_PATH_PREFIX)) return t

  const path = avatarsStorageObjectPathFromUrl(t)
  if (!path) return t

  const encoded = path
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/")

  return `${AVATAR_MEDIA_PROXY_PATH_PREFIX}${encoded}`
}
