import type { Metadata } from "next"
import { publicSiteOrigin } from "@/lib/public-site-origin"

export function absoluteUrl(path: string): string {
  const base = publicSiteOrigin()
  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base
  const p = path.startsWith("/") ? path : `/${path}`
  return `${normalizedBase}${p}`
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
