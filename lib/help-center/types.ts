import type { ReactNode } from "react"

export const HELP_TOPIC_IDS = ["buying", "selling", "accounts"] as const

export type HelpCenterTabId = (typeof HELP_TOPIC_IDS)[number]

export type HelpArticleAudience = "buyer" | "seller" | "both"

/** Support-hub aligned tags plus finer intents for ticket retrieval. */
export type HelpIntentTag =
  | "purchase"
  | "sale"
  | "claim"
  | "buying_selling"
  | "payments"
  | "account"
  | "safety"
  | "general"
  | "offers"
  | "shipping"
  | "we-buy"
  | "cart"
  | "promo"
  | "protection"
  | "returns"
  | "wallet"
  | "payouts"
  | "listings"
  | "messages"
  | "reviews"
  | "search"
  | "following"
  | "notifications"

export type HelpCenterCategoryIconId =
  | "shopping-bag"
  | "credit-card"
  | "package-search"
  | "package"
  | "banknote"
  | "clipboard-list"
  | "tags"
  | "user-round"
  | "wallet"
  | "shield-check"

export type HelpCenterBreadcrumb = {
  label: string
  href?: string
}

export type HelpArticleSection = {
  heading?: string
  body: ReactNode
  /** Optional screenshot shown below the section body. */
  figure?: HelpArticleFigure
}

export type HelpArticleFigure = {
  src: string
  alt: string
  caption?: string
}

export type HelpArticle = {
  slug: string
  topicId: HelpCenterTabId
  title: string
  /** Plain-text summary for SEO metadata and previews. */
  description: string
  sectionSlug: string
  sectionTitle: string
  groupTitle: string
  keywords?: string[]
  quickAnswer?: ReactNode
  sections: HelpArticleSection[]
  /** Other articles in the same topic to surface at the bottom of the page. */
  relatedSlugs?: string[]
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
  description: string
  allArticlesHref: string
  allArticlesLabel: string
  categoryIcons: Record<string, HelpCenterCategoryIconId>
  sections: HelpTopicSection[]
}

export type HelpCenterCategory = {
  title: string
  description: string
  sectionSlug: string
  icon: HelpCenterCategoryIconId
}

export type HelpCenterTab = {
  id: HelpCenterTabId
  label: string
  description: string
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

export type HelpRetrievalSection = {
  heading: string | null
  text: string
}

/**
 * Plain-text help document for search, support retrieval, and ticket replies.
 * Keep this aligned with the matching `/help/{topic}/{slug}` article.
 */
export type HelpRetrievalDocument = {
  id: string
  topicId: HelpCenterTabId
  slug: string
  url: string
  title: string
  description: string
  quickAnswer: string
  audience: HelpArticleAudience
  intentTags: HelpIntentTag[]
  keywords: string[]
  lastReviewed: string
  sections: HelpRetrievalSection[]
  relatedIds: string[]
}
