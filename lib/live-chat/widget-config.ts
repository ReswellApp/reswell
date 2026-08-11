import { getHelpArticleHref } from "@/lib/help-center/registry"
import { helpCenterTopArticlesByTab } from "@/lib/help-center/top-articles"
import type { HelpCenterTabId } from "@/lib/help-center/types"

export const RESEWELL_BOT_NAME = "Reswell Bot"

export const LIVE_CHAT_HOME_GREETING = "We're here to help"
export const LIVE_CHAT_HOME_SUBGREETING = "Buying, selling, or just exploring — ask us anything."
export const LIVE_CHAT_HOME_TAGLINE = "Real people at Reswell"

export const LIVE_CHAT_HOME_HEADER_IMAGE = "/images/live-chat/home-header-barrel.jpg"

export const LIVE_CHAT_HOME_MESSAGE_CTA = "Message the team"
export const LIVE_CHAT_HOME_MESSAGE_SUBONLINE = "Someone from our team is online now"
export const LIVE_CHAT_HOME_MESSAGE_SUBOFFLINE = "We usually reply within one business day"

export const LIVE_CHAT_HOME_HELP_CTA = "Browse help guides"
export const LIVE_CHAT_HOME_HELP_SECTION = "Popular guides"
export const LIVE_CHAT_HOME_TRUST = "Every order includes purchase protection."

export const LIVE_CHAT_MESSAGES_EMPTY =
  "What can we help with? Share an order number, a listing link, or describe what you're running into — we'll get back to you."

export const LIVE_CHAT_MESSAGES_REPLY_NOTE = "We usually reply within one business day"

/** Tappable prompts on the empty chat state — pre-fill the composer to lower the blank-textarea barrier. */
export const LIVE_CHAT_STARTER_TOPICS = [
  { id: "order" as const, label: "Question about an order", starter: "Hi — I have a question about my order. " },
  { id: "selling" as const, label: "Selling my board", starter: "Hi — I'm looking to sell and had a question. " },
  { id: "other" as const, label: "Something else", starter: "" },
]

export const LIVE_CHAT_BOT_MISSION =
  "We're building the best marketplace for surfers — boards, wetsuits, fins, and more. Ask us anything!"

export const LIVE_CHAT_BOT_INTRO = `Hi! I'm ${RESEWELL_BOT_NAME}, a friendly assistant here to help you on Reswell. Our human teammates may not always be online, but I can point you to answers — and you can always leave a message for the team.

AI answers trained on Reswell are coming soon. For now, browse help articles or connect with our team below.`

export const LIVE_CHAT_BOT_AI_STUB = `${RESEWELL_BOT_NAME} AI is coming soon — we're training it on Reswell policies, shipping, payouts, and purchase protection.

In the meantime, try the help articles below or tap "Wait for the team" to message a human.`

export const LIVE_CHAT_BOT_HANDOFF = `Our team is small but mighty! We typically reply within one business day.

Share your question below — include an order number, listing link, or screenshots if you have them.`

export const LIVE_CHAT_QUICK_ACTIONS = [
  { id: "ask_ai" as const, label: "Ask Reswell AI" },
  { id: "wait_team" as const, label: "Wait for the team 👤" },
]

export type LiveChatHelpLink = {
  title: string
  href: string
  topicId: HelpCenterTabId
  slug: string
}

export type LiveChatHelpArticleRef = {
  topicId: HelpCenterTabId
  slug: string
}

function toHelpLink(article: {
  title: string
  slug: string
  topicId: HelpCenterTabId
}): LiveChatHelpLink {
  return {
    title: article.title,
    href: getHelpArticleHref({ topicId: article.topicId, slug: article.slug }),
    topicId: article.topicId,
    slug: article.slug,
  }
}

/** Curated links shown in Home + bot handoff cards. */
export const LIVE_CHAT_HELP_LINKS: LiveChatHelpLink[] = [
  toHelpLink(helpCenterTopArticlesByTab.buying[3]!), // purchase protection
  toHelpLink(helpCenterTopArticlesByTab.buying[1]!), // how to buy
  toHelpLink(helpCenterTopArticlesByTab.selling[4]!), // marketplace fees
  toHelpLink(helpCenterTopArticlesByTab.buying[6]!), // delayed package
  toHelpLink(helpCenterTopArticlesByTab.selling[2]!), // sold whats next
  toHelpLink(helpCenterTopArticlesByTab.accounts[5]!), // scams
].filter(Boolean)

export const LIVE_CHAT_HOME_HELP_PREVIEW = LIVE_CHAT_HELP_LINKS.slice(0, 4)

export const LIVE_CHAT_HANDOFF_HELP_PREVIEW = LIVE_CHAT_HELP_LINKS.slice(0, 3)
