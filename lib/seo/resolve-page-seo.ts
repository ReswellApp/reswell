import "server-only"
import type { Metadata } from "next"
import { unstable_cache } from "next/cache"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { absoluteUrl } from "@/lib/site-metadata"
import { getManagedPage } from "@/lib/seo/managed-pages"
import {
  computeEffectivePageSeo,
  EMPTY_OVERRIDE,
  type EffectivePageSeo,
  type PageSeoOverrideValues,
} from "@/lib/seo/types"
import { getPageSeoOverrideByKey } from "@/lib/db/page-seo"
import { mapOverrideRowToValues } from "@/lib/seo/map-override-row"
import { PAGE_SEO_CACHE_TAG } from "@/lib/seo/page-seo-cache"

/**
 * Cached override lookup. Uses the service-role client (RLS only allows staff to read the
 * table directly) and is tagged so the admin panel can revalidate after a save.
 */
const getCachedOverrideValues = unstable_cache(
  async (pageKey: string): Promise<PageSeoOverrideValues> => {
    try {
      const supabase = createServiceRoleClient()
      const row = await getPageSeoOverrideByKey(supabase, pageKey)
      return mapOverrideRowToValues(row)
    } catch (error) {
      // Missing service role env or transient failure: fall back to code defaults.
      console.error("getCachedOverrideValues:", error instanceof Error ? error.message : error)
      return EMPTY_OVERRIDE
    }
  },
  ["page-seo-override"],
  { tags: [PAGE_SEO_CACHE_TAG], revalidate: 300 },
)

function effectiveToMetadata(eff: EffectivePageSeo): Metadata {
  const canonicalIsAbsolute = /^https?:\/\//i.test(eff.canonical)
  const ogUrl = canonicalIsAbsolute ? eff.canonical : absoluteUrl(eff.canonical)

  const ogImages = eff.ogImageUrl ? [{ url: eff.ogImageUrl }] : undefined
  const twitterImages = eff.twitterImageUrl ? [eff.twitterImageUrl] : undefined

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
      ...(ogImages ? { images: ogImages } : {}),
    },
    twitter: {
      card: eff.twitterCard,
      title: eff.twitterTitle,
      description: eff.twitterDescription,
      ...(twitterImages ? { images: twitterImages } : {}),
    },
  }
}

/**
 * Resolve final `Metadata` for a managed page: code defaults merged with the saved override.
 * Call from a page's `generateMetadata`. Unknown keys fall back to a bare title.
 */
export async function resolvePageMetadata(pageKey: string): Promise<Metadata> {
  const managed = getManagedPage(pageKey)
  if (!managed) {
    console.error("resolvePageMetadata: unknown page key", pageKey)
    return {}
  }
  const override = await getCachedOverrideValues(pageKey)
  const effective = computeEffectivePageSeo(managed.defaults, override)
  return effectiveToMetadata(effective)
}

/** Effective SEO values (not Metadata) for a managed page — for JSON-LD injection, etc. */
export async function resolveEffectivePageSeo(pageKey: string): Promise<EffectivePageSeo | null> {
  const managed = getManagedPage(pageKey)
  if (!managed) return null
  const override = await getCachedOverrideValues(pageKey)
  return computeEffectivePageSeo(managed.defaults, override)
}

/** Cached override values for a managed page (used to merge into dynamic metadata helpers). */
export async function getPageSeoOverride(pageKey: string): Promise<PageSeoOverrideValues> {
  return getCachedOverrideValues(pageKey)
}
