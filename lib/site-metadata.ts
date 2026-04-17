import type { Metadata } from "next"
import { publicSiteOrigin } from "@/lib/public-site-origin"

export function absoluteUrl(path: string): string {
  const base = publicSiteOrigin()
  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base
  const p = path.startsWith("/") ? path : `/${path}`
  return `${normalizedBase}${p}`
}

/** Absolute URL for listing/storage images (already-absolute https left unchanged). */
export function absolutePublicMediaUrl(url: string | null | undefined): string | undefined {
  if (!url?.trim()) return undefined
  const u = url.trim()
  if (/^https?:\/\//i.test(u)) return u
  return absoluteUrl(u)
}

/**
 * Consistent title, description, canonical, and Open Graph / Twitter tags for static pages.
 * Prefer colocated `opengraph-image.tsx` for unique share art; this sets text metadata.
 */
export function pageSeoMetadata(opts: {
  title: string
  description: string
  path: string
  openGraphType?: "website" | "article"
  robots?: Metadata["robots"]
}): Metadata {
  const url = absoluteUrl(opts.path)
  return {
    title: opts.title,
    description: opts.description,
    alternates: { canonical: opts.path },
    ...(opts.robots ? { robots: opts.robots } : {}),
    openGraph: {
      title: opts.title,
      description: opts.description,
      type: opts.openGraphType ?? "website",
      url,
    },
    twitter: {
      card: "summary_large_image",
      title: opts.title,
      description: opts.description,
    },
  }
}

/** Logged-in or flow pages: unique title/description without allowing public indexing. */
export function privatePageMetadata(opts: { title: string; description: string; path: string }): Metadata {
  return pageSeoMetadata({
    ...opts,
    robots: { index: false, follow: false },
  })
}
