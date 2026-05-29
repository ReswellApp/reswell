import "server-only"
import { getPageSeoOverride } from "@/lib/seo/resolve-page-seo"
import { getDynamicPageType } from "@/lib/seo/dynamic-page-types"
import { applySeoTemplate } from "@/lib/seo/apply-template"

export interface DynamicSeoResult {
  title: string
  description: string
  /** Override of the default index/follow flags, when the admin set them on the type. */
  robotsIndex: boolean | null
  robotsFollow: boolean | null
  /** Admin-set OG image template/url for the type, if any. */
  ogImageUrl: string | null
}

/**
 * Resolve title/description for a dynamic page instance using the admin-saved template for its
 * type (`type:listing` etc.), filled with `vars`. Falls back to the provided defaults when no
 * template is set or a rendered value comes out empty. Cached via the page-seo override cache.
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

  const override = await getPageSeoOverride(typeKey)

  const titleTpl = override.title?.trim()
  const descTpl = override.description?.trim()

  const renderedTitle = titleTpl ? applySeoTemplate(titleTpl, vars) : ""
  const renderedDesc = descTpl ? applySeoTemplate(descTpl, vars) : ""

  return {
    title: renderedTitle || fallback.title,
    description: renderedDesc || fallback.description,
    robotsIndex: typeof override.robotsIndex === "boolean" ? override.robotsIndex : null,
    robotsFollow: typeof override.robotsFollow === "boolean" ? override.robotsFollow : null,
    ogImageUrl: override.ogImageUrl?.trim() || null,
  }
}
