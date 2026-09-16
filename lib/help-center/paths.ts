import { HELP_TOPIC_IDS, type HelpCenterTabId } from "./types.ts"

/** Matches site footer (`bg-listingHeart`). */
export const HELP_CENTER_ACCENT = "#355185"

/** ISO date shared by help articles reviewed in this rebuild. */
export const HELP_CENTER_LAST_REVIEWED = "2026-09-14"

export function helpTopicPath(topicId: HelpCenterTabId): string {
  return `/help/${topicId}`
}

export function helpArticlePath(topicId: HelpCenterTabId, slug: string): string {
  return `/help/${topicId}/${slug}`
}

export function helpTopicSectionPath(topicId: HelpCenterTabId, sectionSlug: string): string {
  return `${helpTopicPath(topicId)}#${sectionSlug}`
}

export function helpArticleId(topicId: HelpCenterTabId, slug: string): string {
  return `${topicId}/${slug}`
}

export function isHelpTopicId(value: string): value is HelpCenterTabId {
  return (HELP_TOPIC_IDS as readonly string[]).includes(value)
}

/** Parses `/help/{topic}/{slug}` (optionally absolute) into topic + slug. */
export function parseHelpArticlePath(
  href: string,
): { topicId: HelpCenterTabId; slug: string } | null {
  try {
    const path = href.startsWith("http") ? new URL(href).pathname : href.split(/[?#]/)[0] ?? href
    const match = path.match(/^\/help\/([^/]+)\/([^/]+)\/?$/)
    if (!match) return null
    const topicId = match[1]
    if (!topicId || !isHelpTopicId(topicId)) return null
    return { topicId, slug: match[2]! }
  } catch {
    return null
  }
}
