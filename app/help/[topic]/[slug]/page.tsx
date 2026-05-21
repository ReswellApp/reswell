import { notFound } from "next/navigation"
import { HelpCenterArticleView } from "@/components/features/help-center/help-center-article-view"
import {
  getAllArticleParams,
  getHelpArticle,
  isHelpTopicId,
} from "@/lib/help-center/registry"
import { helpArticlePath } from "@/lib/help-center/paths"
import { pageSeoMetadata } from "@/lib/site-metadata"
import type { HelpCenterTabId } from "@/lib/help-center/types"

type PageProps = {
  params: Promise<{ topic: string; slug: string }>
}

export function generateStaticParams() {
  return getAllArticleParams().map(({ topic, slug }) => ({ topic, slug }))
}

export async function generateMetadata({ params }: PageProps) {
  const { topic: topicParam, slug } = await params
  if (!isHelpTopicId(topicParam)) return {}
  const article = getHelpArticle(topicParam, slug)
  if (!article) return {}
  return pageSeoMetadata({
    title: `${article.title} — Help Center — Reswell`,
    description: article.description,
    path: helpArticlePath(topicParam, slug),
  })
}

export default async function HelpArticlePage({ params }: PageProps) {
  const { topic: topicParam, slug } = await params
  if (!isHelpTopicId(topicParam)) notFound()
  const article = getHelpArticle(topicParam as HelpCenterTabId, slug)
  if (!article) notFound()
  return <HelpCenterArticleView article={article} />
}
