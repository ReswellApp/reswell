import type { ManagedPageDefaults, ManagedPageGroupId } from "@/lib/seo/managed-pages"

/** The fully-resolved SEO for a managed page (code defaults in `lib/seo/managed-pages.ts`). */
export interface EffectivePageSeo {
  title: string
  description: string
  keywords: string[]
  /** Absolute or path-based canonical (resolver turns this into an absolute URL). */
  canonical: string
  robotsIndex: boolean
  robotsFollow: boolean
  ogTitle: string
  ogDescription: string
  ogImageUrl: string | null
  ogType: "website" | "article"
  twitterCard: "summary" | "summary_large_image"
  twitterTitle: string
  twitterDescription: string
  twitterImageUrl: string | null
  structuredData: unknown | null
}

function nonEmpty(v: string | null | undefined): v is string {
  return typeof v === "string" && v.trim().length > 0
}

/** Resolve effective SEO from code defaults (single source of truth). */
export function defaultsToEffectivePageSeo(defaults: ManagedPageDefaults): EffectivePageSeo {
  const title = defaults.title
  const description = defaults.description

  return {
    title,
    description,
    keywords: defaults.keywords ?? [],
    canonical: defaults.path,
    robotsIndex: defaults.robotsIndex,
    robotsFollow: defaults.robotsFollow,
    ogTitle: nonEmpty(defaults.ogTitle) ? defaults.ogTitle.trim() : title,
    ogDescription: nonEmpty(defaults.ogDescription) ? defaults.ogDescription.trim() : description,
    ogImageUrl: nonEmpty(defaults.ogImageUrl) ? defaults.ogImageUrl.trim() : null,
    ogType: defaults.openGraphType,
    twitterCard: defaults.twitterCard ?? "summary_large_image",
    twitterTitle: nonEmpty(defaults.twitterTitle) ? defaults.twitterTitle.trim() : title,
    twitterDescription: nonEmpty(defaults.twitterDescription)
      ? defaults.twitterDescription.trim()
      : description,
    twitterImageUrl: nonEmpty(defaults.twitterImageUrl)
      ? defaults.twitterImageUrl.trim()
      : nonEmpty(defaults.ogImageUrl)
        ? defaults.ogImageUrl.trim()
        : null,
    structuredData: defaults.structuredData ?? null,
  }
}

/** Variable available to a dynamic page-type template (mirrors DynamicTemplateVar). */
export interface ManagedPageTemplateVar {
  token: string
  label: string
  sample: string
}

/** One row in the admin SEO reference panel. */
export interface ManagedPageSeoItem {
  key: string
  group: ManagedPageGroupId
  label: string
  note?: string
  variationOf?: string
  defaults: ManagedPageDefaults
  /** "dynamic" items are template-based page families (listings, brands, sellers). */
  kind?: "page" | "dynamic"
  /** Template variables, present only for dynamic items. */
  templateVars?: ManagedPageTemplateVar[]
}
