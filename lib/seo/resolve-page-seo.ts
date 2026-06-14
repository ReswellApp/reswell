import "server-only"
import type { Metadata } from "next"
import { metadataShareImageUrl } from "@/lib/public-media-display-src"
import { absoluteUrl } from "@/lib/site-metadata"
import { getManagedPage, MANAGED_PAGES } from "@/lib/seo/managed-pages"
import { defaultsToEffectivePageSeo, type EffectivePageSeo } from "@/lib/seo/types"

/** Branded auto-generated OG image (next/og) for pages without a custom share image. */
function autoOgImageUrl(eff: EffectivePageSeo): string {
  const params = new URLSearchParams({ title: eff.ogTitle.slice(0, 120) })
  if (eff.description) params.set("subtitle", eff.description.slice(0, 120))
  return absoluteUrl(`/api/og?${params.toString()}`)
}

function effectiveToMetadata(eff: EffectivePageSeo): Metadata {
  const canonicalIsAbsolute = /^https?:\/\//i.test(eff.canonical)
  const ogUrl = canonicalIsAbsolute ? eff.canonical : absoluteUrl(eff.canonical)

  const resolvedOgImage = eff.ogImageUrl
    ? metadataShareImageUrl(eff.ogImageUrl)
    : autoOgImageUrl(eff)
  const ogImages = [{ url: resolvedOgImage, width: 1200, height: 630 }]
  const twitterImages = [
    eff.twitterImageUrl ? metadataShareImageUrl(eff.twitterImageUrl) : resolvedOgImage,
  ]

  return {
    title: eff.title,
    description: eff.description,
    ...(eff.keywords.length > 0 ? { keywords: eff.keywords } : {}),
    alternates: { canonical: eff.canonical },
    robots: {
      index: eff.robotsIndex,
      follow: eff.robotsFollow,
      googleBot: { index: eff.robotsIndex, follow: eff.robotsFollow },
    },
    openGraph: {
      title: eff.ogTitle,
      description: eff.ogDescription,
      type: eff.ogType,
      url: ogUrl,
      images: ogImages,
    },
    twitter: {
      card: eff.twitterCard,
      title: eff.twitterTitle,
      description: eff.twitterDescription,
      images: twitterImages,
    },
  }
}

/**
 * Resolve final `Metadata` for a managed page from code defaults in `lib/seo/managed-pages.ts`.
 * Call from a page's `generateMetadata`. Unknown keys fall back to a bare title.
 */
export async function resolvePageMetadata(pageKey: string): Promise<Metadata> {
  const managed = getManagedPage(pageKey)
  if (!managed) {
    console.error("resolvePageMetadata: unknown page key", pageKey)
    return {}
  }
  return effectiveToMetadata(defaultsToEffectivePageSeo(managed.defaults))
}

/** Effective SEO values (not Metadata) for a managed page — for JSON-LD injection, etc. */
export async function resolveEffectivePageSeo(pageKey: string): Promise<EffectivePageSeo | null> {
  const managed = getManagedPage(pageKey)
  if (!managed) return null
  return defaultsToEffectivePageSeo(managed.defaults)
}

/**
 * Normalized paths (e.g. `/faq`) of managed pages marked no-index in code defaults.
 * Used to drop them from the sitemap so we never advertise URLs we ask Google not to index.
 */
export async function getNoindexManagedPaths(): Promise<Set<string>> {
  const paths: string[] = []
  for (const page of MANAGED_PAGES) {
    if (!page.defaults.robotsIndex) {
      paths.push(page.defaults.path.split("?")[0].replace(/\/+$/, "") || "/")
    }
  }
  return new Set(paths)
}
