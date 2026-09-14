import { helpArticles } from "@/lib/help-center/articles"
import { helpTopicIndexes } from "@/lib/help-center/topics"
import { getHelpRetrievalDocument, helpRetrievalHaystack } from "@/lib/help-center/retrieval-docs"
import type {
  HelpArticle,
  HelpArticleLink,
  HelpCenterTab,
  HelpCenterTabId,
  HelpTopicIndex,
} from "@/lib/help-center/types"
import { HELP_TOPIC_IDS } from "@/lib/help-center/types"
import { helpArticlePath, isHelpTopicId as pathIsHelpTopicId } from "@/lib/help-center/paths"

export { isHelpTopicId } from "@/lib/help-center/paths"

const articlesBySlug = new Map<string, HelpArticle>(
  helpArticles.map((article) => [`${article.topicId}/${article.slug}`, article]),
)

const articlesBySlugOnly = new Map<string, HelpArticle[]>()
for (const article of helpArticles) {
  const existing = articlesBySlugOnly.get(article.slug) ?? []
  existing.push(article)
  articlesBySlugOnly.set(article.slug, existing)
}

const topicById = new Map<HelpCenterTabId, HelpTopicIndex>(
  helpTopicIndexes.map((topic) => [topic.id, topic]),
)

export function getHelpTopicIds(): HelpCenterTabId[] {
  return [...HELP_TOPIC_IDS]
}

export function getHelpTopic(topicId: HelpCenterTabId): HelpTopicIndex | undefined {
  return topicById.get(topicId)
}

export function getHelpArticle(topicId: HelpCenterTabId, slug: string): HelpArticle | undefined {
  return articlesBySlug.get(`${topicId}/${slug}`)
}

export function getHelpArticleBySlug(slug: string, preferredTopicId?: HelpCenterTabId): HelpArticle | undefined {
  if (preferredTopicId) {
    const preferred = getHelpArticle(preferredTopicId, slug)
    if (preferred) return preferred
  }
  const matches = articlesBySlugOnly.get(slug)
  return matches?.[0]
}

export function getAllHelpArticles(): HelpArticle[] {
  return helpArticles
}

export function getHelpArticleHref(article: Pick<HelpArticle, "topicId" | "slug">): string {
  return helpArticlePath(article.topicId, article.slug)
}

export function toHelpArticleLink(article: HelpArticle): HelpArticleLink & { href: string } {
  return {
    slug: article.slug,
    title: article.title,
    href: getHelpArticleHref(article),
  }
}

export function getHelpCenterTabs(): HelpCenterTab[] {
  return helpTopicIndexes.map((topic) => ({
    id: topic.id,
    label: topic.label,
    description: topic.description,
    allArticlesHref: topic.allArticlesHref,
    allArticlesLabel: topic.allArticlesLabel,
    categories: topic.sections.map((section) => ({
      title: section.title,
      description: section.groups.map((group) => group.title).join(" · "),
      sectionSlug: section.slug,
      icon: topic.categoryIcons[section.slug] ?? "package-search",
    })),
  }))
}

export function getArticleBreadcrumbs(article: HelpArticle) {
  const topic = getHelpTopic(article.topicId)
  return [
    { label: "Reswell.com", href: "/" },
    { label: "Help Center", href: "/help" },
    { label: topic?.label ?? article.topicId, href: `/help/${article.topicId}` },
    {
      label: article.sectionTitle,
      href: `/help/${article.topicId}#${article.sectionSlug}`,
    },
    { label: article.title },
  ]
}

export function getTopicBreadcrumbs(topic: HelpTopicIndex) {
  return [
    { label: "Reswell.com", href: "/" },
    { label: "Help Center", href: "/help" },
    { label: topic.label },
  ]
}

export function getRelatedHelpArticles(article: HelpArticle): HelpArticle[] {
  if (!article.relatedSlugs?.length) return []
  const seen = new Set<string>()
  const related: HelpArticle[] = []
  for (const slug of article.relatedSlugs) {
    const match = slug.includes("/")
      ? (() => {
          const [topicId, articleSlug] = slug.split("/")
          return pathIsHelpTopicId(topicId) && articleSlug
            ? getHelpArticle(topicId, articleSlug)
            : undefined
        })()
      : getHelpArticleBySlug(slug, article.topicId)
    if (!match) continue
    const key = `${match.topicId}/${match.slug}`
    if (key === `${article.topicId}/${article.slug}` || seen.has(key)) continue
    seen.add(key)
    related.push(match)
  }
  return related
}

export function filterHelpCenterArticles(
  query: string,
  articles: HelpArticle[] = helpArticles,
): HelpArticle[] {
  const q = query.trim().toLowerCase()
  if (!q) return articles
  return articles.filter((article) => {
    const retrieval = getHelpRetrievalDocument(article.topicId, article.slug)
    const haystack = [
      article.title,
      article.description,
      article.sectionTitle,
      article.groupTitle,
      ...(article.keywords ?? []),
      retrieval ? helpRetrievalHaystack(retrieval) : "",
    ]
      .join(" ")
      .toLowerCase()
    return haystack.includes(q)
  })
}

export function getAllArticleParams(): { topic: HelpCenterTabId; slug: string }[] {
  return helpArticles.map((article) => ({ topic: article.topicId, slug: article.slug }))
}

export function getAllTopicParams(): { topic: HelpCenterTabId }[] {
  return getHelpTopicIds().map((topic) => ({ topic }))
}
