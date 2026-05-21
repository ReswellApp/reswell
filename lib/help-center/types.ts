import type { ReactNode } from "react"

export type HelpCenterTabId = "buying" | "selling" | "accounts"

export type HelpCenterBreadcrumb = {
  label: string
  href?: string
}

export type HelpArticleSection = {
  heading?: string
  body: ReactNode
}

export type HelpArticle = {
  slug: string
  topicId: HelpCenterTabId
  title: string
  sectionSlug: string
  sectionTitle: string
  groupTitle: string
  keywords?: string[]
  quickAnswer?: ReactNode
  sections: HelpArticleSection[]
}

export type HelpArticleLink = {
  slug: string
  title: string
}

export type HelpTopicGroup = {
  title: string
  articles: HelpArticleLink[]
}

export type HelpTopicSection = {
  title: string
  slug: string
  groups: HelpTopicGroup[]
}

export type HelpTopicIndex = {
  id: HelpCenterTabId
  label: string
  allArticlesHref: string
  allArticlesLabel: string
  categoryImages: Record<string, { src: string; alt: string }>
  sections: HelpTopicSection[]
}

export type HelpCenterCategory = {
  title: string
  sectionSlug: string
  imageSrc: string
  imageAlt: string
}

export type HelpCenterTab = {
  id: HelpCenterTabId
  label: string
  allArticlesHref: string
  allArticlesLabel: string
  categories: HelpCenterCategory[]
}

export type HelpCenterTopArticle = {
  title: string
  slug: string
  topicId: HelpCenterTabId
}

export type HelpCenterResource = {
  title: string
  href: string
  highlight?: boolean
}
