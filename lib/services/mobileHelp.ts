import {
  MOBILE_HELP_TOPIC_IDS,
  mobileHelpArticleSchema,
  mobileHelpHubSchema,
  mobileHelpTopicSchema,
  type MobileHelpArticle,
  type MobileHelpArticleRef,
  type MobileHelpHub,
  type MobileHelpTopic,
  type MobileHelpTopicId,
} from "@reswell/api-contract"
import { isHelpTopicId } from "@/lib/help-center/paths"
import {
  getAllHelpRetrievalDocuments,
  getHelpRetrievalDocument,
  searchHelpRetrievalDocuments,
} from "@/lib/help-center/retrieval-docs"
import { helpCenterTopArticlesByTab } from "@/lib/help-center/top-articles"
import { helpTopicIndexes } from "@/lib/help-center/topics"
import type { MobileApiResult } from "@/lib/services/mobileApi"

function isHelpTopic(value: string): value is MobileHelpTopicId {
  return (MOBILE_HELP_TOPIC_IDS as readonly string[]).includes(value)
}

function articleRef(
  topicId: MobileHelpTopicId,
  slug: string,
  title: string,
  description: string | null = null,
): MobileHelpArticleRef {
  return { topic_id: topicId, slug, title, description }
}

function featuredArticles(): MobileHelpArticleRef[] {
  const seen = new Set<string>()
  const featured: MobileHelpArticleRef[] = []
  for (const topicId of MOBILE_HELP_TOPIC_IDS) {
    for (const article of helpCenterTopArticlesByTab[topicId].slice(0, 4)) {
      const key = `${article.topicId}/${article.slug}`
      if (seen.has(key)) continue
      seen.add(key)
      featured.push(articleRef(article.topicId, article.slug, article.title))
      if (featured.length >= 8) return featured
    }
  }
  return featured
}

export function getMobileHelpHub(query = ""): MobileHelpHub {
  const documents = getAllHelpRetrievalDocuments()
  const topics = MOBILE_HELP_TOPIC_IDS.map((id) => {
    const topic = helpTopicIndexes.find((item) => item.id === id)
    return {
      id,
      label: topic?.label ?? id,
      description: topic?.description ?? "",
      article_count: documents.filter((doc) => doc.topicId === id).length,
    }
  })

  const q = query.trim()
  const results = q
    ? searchHelpRetrievalDocuments(q).slice(0, 20).map((doc) =>
        articleRef(doc.topicId, doc.slug, doc.title, doc.description),
      )
    : []

  return mobileHelpHubSchema.parse({
    title: "Help Center",
    description: "Answers for buying, selling, payouts, and your Reswell account.",
    topics,
    featured: featuredArticles(),
    results,
  })
}

export function getMobileHelpTopic(topicId: string): MobileApiResult<MobileHelpTopic> {
  if (!isHelpTopicId(topicId) || !isHelpTopic(topicId)) {
    return { ok: false, status: 404, error: "Help topic not found" }
  }
  const topic = helpTopicIndexes.find((item) => item.id === topicId)
  if (!topic) return { ok: false, status: 404, error: "Help topic not found" }

  return {
    ok: true,
    data: mobileHelpTopicSchema.parse({
      id: topicId,
      label: topic.label,
      description: topic.description,
      sections: topic.sections.map((section) => ({
        title: section.title,
        groups: section.groups.map((group) => ({
          title: group.title,
          articles: group.articles.map((article) => articleRef(topicId, article.slug, article.title)),
        })),
      })),
    }),
  }
}

export function getMobileHelpArticle(
  topicId: string,
  slug: string,
): MobileApiResult<MobileHelpArticle> {
  if (!isHelpTopicId(topicId) || !isHelpTopic(topicId)) {
    return { ok: false, status: 404, error: "Help article not found" }
  }
  const doc = getHelpRetrievalDocument(topicId, slug.trim())
  if (!doc) return { ok: false, status: 404, error: "Help article not found" }

  const related = doc.relatedIds
    .map((id) => {
      const [relatedTopic, relatedSlug] = id.split("/")
      if (!relatedTopic || !relatedSlug || !isHelpTopic(relatedTopic)) return null
      const relatedDoc = getHelpRetrievalDocument(relatedTopic, relatedSlug)
      if (!relatedDoc) return null
      return articleRef(relatedTopic, relatedSlug, relatedDoc.title, relatedDoc.description)
    })
    .filter((item): item is MobileHelpArticleRef => item !== null)

  return {
    ok: true,
    data: mobileHelpArticleSchema.parse({
      topic_id: topicId,
      slug: doc.slug,
      title: doc.title,
      description: doc.description,
      quick_answer: doc.quickAnswer,
      sections: doc.sections.map((section) => ({
        heading: section.heading,
        text: section.text,
      })),
      related,
    }),
  }
}
