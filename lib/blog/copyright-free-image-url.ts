import { blogImagesStorageObjectPathFromUrl } from "@/lib/blog/blog-media-proxy-url"

/** Hosts that publish a clear free-to-use license for the image files themselves. */
const COPYRIGHT_FREE_REMOTE_HOSTS = new Set([
  "images.unsplash.com",
  "images.pexels.com",
  "upload.wikimedia.org",
  "commons.wikimedia.org",
  "pixabay.com",
  "cdn.pixabay.com",
])

export const BLOG_COPYRIGHT_FREE_IMAGE_ERROR =
  "Blog images must be copyright-free (Unsplash, Pexels, Pixabay, Wikimedia Commons) or a file you uploaded to Reswell. Brand, Shopify, and product-catalog photos are not allowed."

/**
 * True when `url` is HTTPS and either lives in Reswell `blog-images` storage
 * or on an allowlisted copyright-free CDN.
 */
export function isCopyrightFreeBlogImageUrl(url: string): boolean {
  const raw = url.trim()
  if (!raw) return false

  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return false
  }

  if (parsed.protocol !== "https:") return false
  if (blogImagesStorageObjectPathFromUrl(raw)) return true

  const host = parsed.hostname.replace(/^www\./i, "").toLowerCase()
  return COPYRIGHT_FREE_REMOTE_HOSTS.has(host)
}
