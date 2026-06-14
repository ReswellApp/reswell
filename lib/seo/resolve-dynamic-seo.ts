import "server-only"
import { getDynamicPageType } from "@/lib/seo/dynamic-page-types"
import { applySeoTemplate } from "@/lib/seo/apply-template"

export interface DynamicSeoResult {
  title: string
  description: string
  /** Index/follow flags from code templates, when set. */
  robotsIndex: boolean | null
  robotsFollow: boolean | null
  /** OG image URL for the type, if set in code defaults. */
  ogImageUrl: string | null
}

/**
 * Resolve title/description for a dynamic page instance using code templates in
 * `lib/seo/dynamic-page-types.ts`, filled with `vars`. Falls back to the provided defaults
 * when a rendered value comes out empty.
 */
export async function resolveDynamicSeo(
  typeKey: string,
  vars: Record<string, string | undefined>,
  fallback: { title: string; description: string },
): Promise<DynamicSeoResult> {
  const type = getDynamicPageType(typeKey)
  if (!type) {
    return { title: fallback.title, description: fallback.description, robotsIndex: null, robotsFollow: null, ogImageUrl: null }
  }

  const renderedTitle = applySeoTemplate(type.defaultTitleTemplate, vars)
  const renderedDesc = applySeoTemplate(type.defaultDescriptionTemplate, vars)

  return {
    title: renderedTitle || fallback.title,
    description: renderedDesc || fallback.description,
    robotsIndex: null,
    robotsFollow: null,
    ogImageUrl: null,
  }
}
