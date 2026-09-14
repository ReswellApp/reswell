import { HELP_CENTER_LAST_REVIEWED, helpArticleId, helpArticlePath } from "../paths.ts"
import type {
  HelpArticleAudience,
  HelpCenterTabId,
  HelpIntentTag,
  HelpRetrievalDocument,
  HelpRetrievalSection,
} from "../types.ts"

export function retrievalDoc(input: {
  topicId: HelpCenterTabId
  slug: string
  title: string
  description: string
  quickAnswer: string
  audience: HelpArticleAudience
  intentTags: HelpIntentTag[]
  keywords: string[]
  sections: HelpRetrievalSection[]
  relatedIds: string[]
  lastReviewed?: string
}): HelpRetrievalDocument {
  return {
    id: helpArticleId(input.topicId, input.slug),
    url: helpArticlePath(input.topicId, input.slug),
    topicId: input.topicId,
    slug: input.slug,
    title: input.title,
    description: input.description,
    quickAnswer: input.quickAnswer,
    audience: input.audience,
    intentTags: input.intentTags,
    keywords: input.keywords,
    lastReviewed: input.lastReviewed ?? HELP_CENTER_LAST_REVIEWED,
    sections: input.sections,
    relatedIds: input.relatedIds,
  }
}
