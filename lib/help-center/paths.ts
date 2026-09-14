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
