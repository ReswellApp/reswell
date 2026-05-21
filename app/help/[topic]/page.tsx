import { notFound } from "next/navigation"
import { HelpCenterTopicView } from "@/components/features/help-center/help-center-topic-view"
import { getHelpTopic, isHelpTopicId } from "@/lib/help-center/registry"
import { helpTopicPath } from "@/lib/help-center/paths"
import { pageSeoMetadata } from "@/lib/site-metadata"
import type { HelpCenterTabId } from "@/lib/help-center/types"

type PageProps = {
  params: Promise<{ topic: string }>
}

export function generateStaticParams() {
  return [{ topic: "buying" }, { topic: "selling" }, { topic: "accounts" }]
}

export async function generateMetadata({ params }: PageProps) {
  const { topic: topicParam } = await params
  if (!isHelpTopicId(topicParam)) return {}
  const topic = getHelpTopic(topicParam)
  if (!topic) return {}
  return pageSeoMetadata({
    title: `${topic.label} — Help Center — Reswell`,
    description: `Browse ${topic.label.toLowerCase()} articles in the Reswell Help Center.`,
    path: helpTopicPath(topicParam),
  })
}

export default async function HelpTopicPage({ params }: PageProps) {
  const { topic: topicParam } = await params
  if (!isHelpTopicId(topicParam)) notFound()
  const topic = getHelpTopic(topicParam as HelpCenterTabId)
  if (!topic) notFound()
  return <HelpCenterTopicView topic={topic} />
}
