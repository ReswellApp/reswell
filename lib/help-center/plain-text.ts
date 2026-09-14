import { getAllHelpArticles, getHelpArticleHref } from "@/lib/help-center/registry"
import type { HelpArticle } from "@/lib/help-center/types"

export type HelpArticlePlainText = {
  slug: string
  topicId: HelpArticle["topicId"]
  title: string
  description: string
  keywords: string[]
  href: string
  body: string
  searchText: string
}

function reactNodeToText(node: unknown): string {
  if (node == null || typeof node === "boolean") return ""
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) {
    return node.map(reactNodeToText).filter(Boolean).join(" ")
  }
  if (typeof node !== "object") return ""

  const props = (node as { props?: Record<string, unknown> }).props ?? {}
  const parts: string[] = []
  if (props.children !== undefined) parts.push(reactNodeToText(props.children))
  if (props.items !== undefined) parts.push(reactNodeToText(props.items))
  if (Array.isArray(props.steps)) {
    for (const step of props.steps) {
      if (!step || typeof step !== "object") continue
      const row = step as { title?: unknown; body?: unknown }
      if (typeof row.title === "string") parts.push(row.title)
      parts.push(reactNodeToText(row.body))
    }
  }
  return parts.filter(Boolean).join(" ")
}

export function helpArticleToPlainText(article: HelpArticle): HelpArticlePlainText {
  const sectionText = article.sections
    .map((section) =>
      [section.heading, reactNodeToText(section.body), section.figure?.caption]
        .filter(Boolean)
        .join(" "),
    )
    .join(" ")
  const body = [reactNodeToText(article.quickAnswer), sectionText]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
  const keywords = article.keywords ?? []
  return {
    slug: article.slug,
    topicId: article.topicId,
    title: article.title,
    description: article.description,
    keywords,
    href: getHelpArticleHref(article),
    body,
    searchText: [article.title, article.description, article.sectionTitle, article.groupTitle, ...keywords, body]
      .join(" ")
      .toLowerCase(),
  }
}

let cachedCorpus: HelpArticlePlainText[] | null = null

/** In-memory help-center corpus. Rebuilds when the article registry changes (deploy). */
export function getHelpCenterPlainTextCorpus(): HelpArticlePlainText[] {
  if (!cachedCorpus) {
    cachedCorpus = getAllHelpArticles().map(helpArticleToPlainText)
  }
  return cachedCorpus
}

export function findHelpArticlesBySlugs(slugs: string[]): HelpArticlePlainText[] {
  const wanted = new Set(slugs)
  return getHelpCenterPlainTextCorpus().filter((article) => wanted.has(article.slug))
}
