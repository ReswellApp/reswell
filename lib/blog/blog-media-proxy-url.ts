const PUBLIC_BLOG_MARKER = "/storage/v1/object/public/blog-images/"

/** Hosts where we store/serve public `blog-images` objects alongside the Supabase project URL. */
function isOurBlogStorageHost(hostname: string): boolean {
  return hostname === "app.reswell.app" || /\.supabase\.co$/i.test(hostname)
}

/**
 * Object path (`cms/{uuid}.{ext}`) from a Saved public bucket URL (`?t=` is ignored — pathname only).
 */
export function blogImagesStorageObjectPathFromUrl(url: string): string | null {
  const raw = url.trim().split(/[?#]/)[0]?.trim()
  if (!raw) return null

  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return null
  }

  if (!isOurBlogStorageHost(parsed.hostname)) return null

  const idx = parsed.pathname.indexOf(PUBLIC_BLOG_MARKER)
  if (idx === -1) return null

  try {
    const path = decodeURIComponent(parsed.pathname.slice(idx + PUBLIC_BLOG_MARKER.length))
    const normalized = path.replace(/^\/+/, "")
    if (!normalized || normalized.includes("..")) return null
    return normalized
  } catch {
    return null
  }
}

/**
 * Same-origin path backed by {@link ../../../app/media/blog/[...path]/route.ts}.
 * Non-storage URLs (Unsplash, Picsum, etc.) are returned unchanged.
 */
export function proxiedBlogImageSrc(url: string | null | undefined): string {
  if (url == null) return ""
  const t = String(url).trim()
  if (!t) return ""
  if (t.startsWith("/media/blog/")) return t

  const path = blogImagesStorageObjectPathFromUrl(t)
  if (!path) return t

  const encoded = path
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/")

  return `/media/blog/${encoded}`
}

/** Full-res originals from `/media/blog/` — skip `/_next/image` re-encoding (same pattern as listings). */
export function blogImageShouldBypassOptimization(src: string | null | undefined): boolean {
  return typeof src === "string" && src.startsWith("/media/blog/")
}
