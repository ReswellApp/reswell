import type { HelpCenterTabId } from "@/lib/help-center/types"

/** Matches site footer (`bg-listingHeart`). */
export const HELP_CENTER_ACCENT = "#355185"

export function helpTopicPath(topicId: HelpCenterTabId): string {
  return `/help/${topicId}`
}

export function helpArticlePath(topicId: HelpCenterTabId, slug: string): string {
  return `/help/${topicId}/${slug}`
}

export function helpTopicSectionPath(topicId: HelpCenterTabId, sectionSlug: string): string {
  return `${helpTopicPath(topicId)}#${sectionSlug}`
}

/** Parses `/help/{topic}/{slug}` (optionally absolute) into topic + slug. */
export function parseHelpArticlePath(
  href: string,
): { topicId: HelpCenterTabId; slug: string } | null {
  try {
    const path = href.startsWith("http") ? new URL(href).pathname : href.split(/[?#]/)[0] ?? href
    const match = path.match(/^\/help\/(buying|selling|accounts)\/([^/]+)\/?$/)
    if (!match) return null
    return { topicId: match[1] as HelpCenterTabId, slug: match[2]! }
  } catch {
    return null
  }
}
