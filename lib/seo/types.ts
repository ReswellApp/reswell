import type { ManagedPageDefaults, ManagedPageGroupId } from "@/lib/seo/managed-pages"

/**
 * Normalized (camelCase) override values. `null`/`undefined` on a field means "inherit the
 * page default". Shared by the admin UI (live preview) and the server resolver.
 */
export interface PageSeoOverrideValues {
  title: string | null
  description: string | null
  keywords: string[] | null
  canonicalUrl: string | null
  robotsIndex: boolean | null
  robotsFollow: boolean | null
  ogTitle: string | null
  ogDescription: string | null
  ogImageUrl: string | null
  ogType: "website" | "article" | null
  twitterCard: "summary" | "summary_large_image" | null
  twitterTitle: string | null
  twitterDescription: string | null
  twitterImageUrl: string | null
  structuredData: unknown | null
}

export const EMPTY_OVERRIDE: PageSeoOverrideValues = {
  title: null,
  description: null,
  keywords: null,
  canonicalUrl: null,
  robotsIndex: null,
  robotsFollow: null,
  ogTitle: null,
  ogDescription: null,
  ogImageUrl: null,
  ogType: null,
  twitterCard: null,
  twitterTitle: null,
  twitterDescription: null,
  twitterImageUrl: null,
  structuredData: null,
}

/** The fully-resolved SEO for a page after merging defaults + override. */
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

/** Pure merge: page defaults with override fields layered on top. */
export function computeEffectivePageSeo(
  defaults: ManagedPageDefaults,
  override: PageSeoOverrideValues,
): EffectivePageSeo {
  const title = nonEmpty(override.title) ? override.title.trim() : defaults.title
  const description = nonEmpty(override.description)
    ? override.description.trim()
    : defaults.description

  return {
    title,
    description,
    keywords:
      override.keywords && override.keywords.length > 0 ? override.keywords : [],
    canonical: nonEmpty(override.canonicalUrl) ? override.canonicalUrl.trim() : defaults.path,
    robotsIndex: typeof override.robotsIndex === "boolean" ? override.robotsIndex : defaults.robotsIndex,
    robotsFollow:
      typeof override.robotsFollow === "boolean" ? override.robotsFollow : defaults.robotsFollow,
    ogTitle: nonEmpty(override.ogTitle) ? override.ogTitle.trim() : title,
    ogDescription: nonEmpty(override.ogDescription) ? override.ogDescription.trim() : description,
    ogImageUrl: nonEmpty(override.ogImageUrl) ? override.ogImageUrl.trim() : null,
    ogType: override.ogType ?? defaults.openGraphType,
    twitterCard: override.twitterCard ?? "summary_large_image",
    twitterTitle: nonEmpty(override.twitterTitle) ? override.twitterTitle.trim() : title,
    twitterDescription: nonEmpty(override.twitterDescription)
      ? override.twitterDescription.trim()
      : description,
    twitterImageUrl: nonEmpty(override.twitterImageUrl)
      ? override.twitterImageUrl.trim()
      : nonEmpty(override.ogImageUrl)
        ? override.ogImageUrl.trim()
        : null,
    structuredData: override.structuredData ?? null,
  }
}

/** Variable available to a dynamic page-type template (mirrors DynamicTemplateVar). */
export interface ManagedPageTemplateVar {
  token: string
  label: string
  sample: string
}

/** One row in the admin SEO panel: a managed page plus its current override (if any). */
export interface ManagedPageSeoItem {
  key: string
  group: ManagedPageGroupId
  label: string
  note?: string
  variationOf?: string
  defaults: ManagedPageDefaults
  override: PageSeoOverrideValues
  /** True when at least one override field is set. */
  customized: boolean
  /** "dynamic" items are template-based page families (listings, brands, sellers). */
  kind?: "page" | "dynamic"
  /** Template variables, present only for dynamic items. */
  templateVars?: ManagedPageTemplateVar[]
}

/** True when no override field is set (page is fully on defaults). */
export function isOverrideEmpty(override: PageSeoOverrideValues): boolean {
  return (
    !nonEmpty(override.title) &&
    !nonEmpty(override.description) &&
    (!override.keywords || override.keywords.length === 0) &&
    !nonEmpty(override.canonicalUrl) &&
    override.robotsIndex === null &&
    override.robotsFollow === null &&
    !nonEmpty(override.ogTitle) &&
    !nonEmpty(override.ogDescription) &&
    !nonEmpty(override.ogImageUrl) &&
    override.ogType === null &&
    override.twitterCard === null &&
    !nonEmpty(override.twitterTitle) &&
    !nonEmpty(override.twitterDescription) &&
    !nonEmpty(override.twitterImageUrl) &&
    override.structuredData === null
  )
}
