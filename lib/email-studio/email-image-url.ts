import { proxiedBlogImageSrc } from "@/lib/blog/blog-media-proxy-url"
import { proxiedListingImageSrc } from "@/lib/listing-media-src"
import { publicSiteOriginForEmail } from "@/lib/public-site-origin"

function absoluteEmailUrl(pathOrUrl: string): string {
  if (/^https:\/\//i.test(pathOrUrl)) return pathOrUrl
  if (!pathOrUrl.startsWith("/")) return pathOrUrl
  const origin = publicSiteOriginForEmail().replace(/\/$/, "")
  return `${origin}${pathOrUrl}`
}

/**
 * URL to store in a Klaviyo template.
 * Blog and listing files are rewritten to the public `/media` proxy on the email site origin.
 */
export function emailImageSrc(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ""
  if (trimmed.startsWith("{{") || trimmed.startsWith("{%")) return trimmed

  const blog = proxiedBlogImageSrc(trimmed)
  if (blog.startsWith("/media/blog/")) {
    return absoluteEmailUrl(blog.split("?")[0] ?? blog)
  }

  const listing = proxiedListingImageSrc(trimmed)
  if (listing.startsWith("/media/listings/") || trimmed.startsWith("/media/listings/")) {
    const path = (listing.startsWith("/media/listings/") ? listing : trimmed).split("?")[0] ?? trimmed
    return absoluteEmailUrl(path)
  }

  if (trimmed.startsWith("/media/") || trimmed.startsWith("/images/")) {
    return absoluteEmailUrl(trimmed.split("?")[0] ?? trimmed)
  }

  if (/^https:\/\/www\.reswell\.app\/media\//i.test(trimmed)) {
    return trimmed.split("?")[0] ?? trimmed
  }

  return trimmed
}
