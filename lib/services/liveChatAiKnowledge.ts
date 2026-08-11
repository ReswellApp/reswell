/**
 * In-process Help Center + FAQ retrieval for live chat AI.
 * Small corpus — keyword ranking is enough for v1 (no vector DB).
 */

import { PLAIN_FAQS } from "@/lib/faq/plain-faqs"
import { getAllHelpArticles, getHelpArticleHref } from "@/lib/help-center/registry"
import type { HelpCenterTabId } from "@/lib/help-center/types"

export type LiveChatKnowledgeChunk = {
  id: string
  source: "help_article" | "faq"
  title: string
  body: string
  href: string
  topicId?: HelpCenterTabId
  slug?: string
  score: number
}

type KnowledgeDoc = {
  id: string
  source: "help_article" | "faq"
  title: string
  body: string
  href: string
  topicId?: HelpCenterTabId
  slug?: string
  tokens: string[]
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2)
}

function uniqueTokens(text: string): string[] {
  return [...new Set(tokenize(text))]
}

function buildKnowledgeDocs(): KnowledgeDoc[] {
  const articles: KnowledgeDoc[] = getAllHelpArticles().map((article) => {
    const keywordText = (article.keywords ?? []).join(" ")
    const body = [article.description, keywordText].filter(Boolean).join("\n")
    return {
      id: `help:${article.topicId}/${article.slug}`,
      source: "help_article" as const,
      title: article.title,
      body,
      href: getHelpArticleHref(article),
      topicId: article.topicId,
      slug: article.slug,
      tokens: uniqueTokens(`${article.title} ${body} ${article.sectionTitle} ${article.groupTitle}`),
    }
  })

  const faqs: KnowledgeDoc[] = PLAIN_FAQS.map((faq) => ({
    id: `faq:${faq.id}`,
    source: "faq" as const,
    title: faq.question,
    body: faq.answerPlain,
    href: faq.href,
    tokens: uniqueTokens(`${faq.question} ${faq.answerPlain}`),
  }))

  return [...articles, ...faqs]
}

let cachedDocs: KnowledgeDoc[] | null = null

function getKnowledgeDocs(): KnowledgeDoc[] {
  if (!cachedDocs) cachedDocs = buildKnowledgeDocs()
  return cachedDocs
}

function scoreDoc(doc: KnowledgeDoc, queryTokens: string[]): number {
  if (queryTokens.length === 0) return 0
  const titleTokens = new Set(tokenize(doc.title))
  let score = 0
  for (const token of queryTokens) {
    if (titleTokens.has(token)) score += 4
    else if (doc.tokens.includes(token)) score += 1
  }
  const covered = queryTokens.filter(
    (t) => titleTokens.has(t) || doc.tokens.includes(t),
  ).length
  score += covered * 0.5
  return score
}

/** Rank Help Center + FAQ docs for a visitor question. */
export function searchHelpArticles(query: string, limit = 5): LiveChatKnowledgeChunk[] {
  const q = query.trim()
  if (q.length < 2) return []

  const queryTokens = uniqueTokens(q)
  if (queryTokens.length === 0) return []

  return getKnowledgeDocs()
    .map((doc) => ({
      id: doc.id,
      source: doc.source,
      title: doc.title,
      body: doc.body,
      href: doc.href,
      topicId: doc.topicId,
      slug: doc.slug,
      score: scoreDoc(doc, queryTokens),
    }))
    .filter((doc) => doc.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, Math.min(limit, 8)))
}

/** Format retrieved chunks for the model system/user context. */
export function formatKnowledgeChunksForPrompt(chunks: LiveChatKnowledgeChunk[]): string {
  if (chunks.length === 0) return "No matching Reswell help articles were found."
  return chunks
    .map(
      (chunk, i) =>
        `[${i + 1}] ${chunk.title}\nSource: ${chunk.href}\n${chunk.body}`,
    )
    .join("\n\n")
}
