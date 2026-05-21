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
