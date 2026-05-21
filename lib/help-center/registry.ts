import { helpArticles } from "@/lib/help-center/articles"
import { helpTopicIndexes } from "@/lib/help-center/topics"
import type {
  HelpArticle,
  HelpArticleLink,
  HelpCenterTab,
  HelpCenterTabId,
  HelpTopicIndex,
} from "@/lib/help-center/types"
import { helpArticlePath } from "@/lib/help-center/paths"

const articlesBySlug = new Map<string, HelpArticle>(
  helpArticles.map((article) => [`${article.topicId}/${article.slug}`, article]),
)

const topicById = new Map<HelpCenterTabId, HelpTopicIndex>(
  helpTopicIndexes.map((topic) => [topic.id, topic]),
)

export function isHelpTopicId(value: string): value is HelpCenterTabId {
  return value === "buying" || value === "selling" || value === "accounts"
}

export function getHelpTopic(topicId: HelpCenterTabId): HelpTopicIndex | undefined {
  return topicById.get(topicId)
}

export function getHelpArticle(topicId: HelpCenterTabId, slug: string): HelpArticle | undefined {
  return articlesBySlug.get(`${topicId}/${slug}`)
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
    allArticlesHref: topic.allArticlesHref,
    allArticlesLabel: topic.allArticlesLabel,
    categories: topic.sections.slice(0, 3).map((section) => ({
      title: section.title,
      sectionSlug: section.slug,
      imageSrc: topic.categoryImages[section.slug]?.src ?? "/images/home/how-it-works-sell-list.png",
      imageAlt: topic.categoryImages[section.slug]?.alt ?? section.title,
    })),
  }))
}

export function getArticleBreadcrumbs(article: HelpArticle) {
  const topic = getHelpTopic(article.topicId)
  return [
    { label: "Reswell.com", href: "/" },
    { label: topic?.label ?? article.topicId, href: `/help/${article.topicId}` },
    {
      label: article.sectionTitle,
      href: `/help/${article.topicId}#${article.sectionSlug}`,
    },
    { label: article.groupTitle },
  ]
}

export function getTopicBreadcrumbs(topic: HelpTopicIndex) {
  return [
    { label: "Reswell.com", href: "/" },
    { label: topic.label },
  ]
}

export function filterHelpCenterArticles(query: string, articles: HelpArticle[] = helpArticles): HelpArticle[] {
  const q = query.trim().toLowerCase()
  if (!q) return articles
  return articles.filter((article) => {
    const haystack = [
      article.title,
      article.description,
      article.sectionTitle,
      article.groupTitle,
      ...(article.keywords ?? []),
    ]
      .join(" ")
      .toLowerCase()
    return haystack.includes(q)
  })
}

export function getAllArticleParams(): { topic: HelpCenterTabId; slug: string }[] {
  return helpArticles.map((article) => ({ topic: article.topicId, slug: article.slug }))
}
