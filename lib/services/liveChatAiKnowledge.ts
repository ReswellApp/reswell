/**
 * In-process Help Center + FAQ retrieval for live chat AI.
 * Small corpus — keyword ranking is enough for v1 (no vector DB).
 */

import type { LiveChatAiListingSummary } from "@/lib/db/liveChatAiListings"
import type { LiveChatAiOrderSummary } from "@/lib/db/liveChatAiOrders"
import { splitLiveChatAiOrdersByRole } from "@/lib/db/liveChatAiOrders"
import { PLAIN_FAQS } from "@/lib/faq/plain-faqs"
import { getAllHelpArticles, getHelpArticleHref } from "@/lib/help-center/registry"
import type { HelpCenterTabId } from "@/lib/help-center/types"
import { MARKETPLACE_FEE_PERCENT, SELLER_SHARE_PERCENT } from "@/lib/seller-fees"
import { SHIPPING_DEADLINE_DAYS } from "@/lib/shipping-deadline"

/** Always-on product facts so the model is grounded even when retrieval misses. */
export const RESWELL_SUPPORT_BRIEF = `Reswell is a peer-to-peer surf marketplace (boards, fins, wetsuits, and more).

Buying
- Browse listings, Message seller, or Make an offer when the seller has offers on.
- Pay only in Reswell checkout. Off-platform payments are not covered by Purchase Protection.
- Every eligible checkout purchase includes Purchase Protection (item never arrives, arrives damaged, or is materially different). Buyers do not pay an extra protection fee.
- Purchases live at /dashboard/purchases. Claims and refund help start from the purchase page.

Selling
- Listing is free. After a sale, open /dashboard/sales to add tracking, buy a label, or verify pickup.
- Ship within ${SHIPPING_DEADLINE_DAYS} days on shipped orders. Earnings stay pending until the item is delivered (tracked shipping) or pickup is verified, then they move to the wallet at /dashboard/earnings.
- Marketplace fee is ${MARKETPLACE_FEE_PERCENT}% of the item price. The seller keeps ${SELLER_SHARE_PERCENT}%. Shipping is collected from the buyer and is not part of seller earnings. Card processing is not deducted from the seller.

Support
- We cannot process refunds, change payouts, or complete admin actions in chat. Explain the correct next step and offer a human handoff for claims, disputes, or account access.
- Useful links: /faq, /protection-policy, /help/buying, /help/selling, /help/accounts.`

const QUERY_SYNONYMS: Record<string, readonly string[]> = {
  paid: ["payout", "cash", "earnings", "wallet"],
  payout: ["paid", "cash", "earnings", "wallet"],
  earnings: ["payout", "paid", "wallet"],
  wallet: ["earnings", "payout", "balance"],
  order: ["purchase", "sale", "tracking"],
  purchase: ["order", "bought", "buyer"],
  sale: ["sold", "seller", "order"],
  tracking: ["shipping", "delivery", "shipped", "package"],
  shipping: ["tracking", "delivery", "ship", "label"],
  fee: ["fees", "commission", "percent"],
  fees: ["fee", "commission"],
  refund: ["return", "claim", "protection"],
  return: ["refund", "claim"],
  claim: ["refund", "protection", "problem"],
  pickup: ["meetup", "local"],
  offer: ["offers", "bid"],
}

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

function expandQueryTokens(query: string): string[] {
  const base = uniqueTokens(query)
  const expanded = new Set(base)
  for (const token of base) {
    const extras = QUERY_SYNONYMS[token]
    if (!extras) continue
    for (const extra of extras) expanded.add(extra)
  }
  return [...expanded]
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

  const queryTokens = expandQueryTokens(q)
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

function formatOrderLine(order: LiveChatAiOrderSummary): string {
  const bits = [
    order.order_num ? `#${order.order_num}` : "order",
    order.listing_title,
    order.status_label ?? order.status,
    order.delivery_status_label ?? order.delivery_status,
    order.fulfillment_method,
    order.tracking_number ? `tracking ${order.tracking_number}` : null,
    order.amount_paid != null ? `paid $${order.amount_paid.toFixed(2)}` : null,
    order.seller_earnings != null ? `earnings $${order.seller_earnings.toFixed(2)}` : null,
    order.dashboard_href,
  ]
  return `- ${bits.filter(Boolean).join(" · ")}`
}

function formatListingLine(listing: LiveChatAiListingSummary): string {
  const bits = [
    listing.title ?? "Listing",
    listing.status,
    listing.price != null ? `$${listing.price.toFixed(2)}` : null,
    listing.listing_href,
  ]
  return `- ${bits.filter(Boolean).join(" · ")}`
}

/** Compact signed-in activity for the model — this account only. */
export function formatMemberActivityForPrompt(input: {
  orders: LiveChatAiOrderSummary[]
  listings: LiveChatAiListingSummary[]
}): string {
  const { purchases, sales } = splitLiveChatAiOrdersByRole(input.orders)
  const listingLines =
    input.listings.length > 0
      ? input.listings.map(formatListingLine).join("\n")
      : "- None on file"

  return `Signed-in member activity (this account only — never invent extra orders or listings):
Purchases:
${purchases.length > 0 ? purchases.map(formatOrderLine).join("\n") : "- None on file"}
Sales:
${sales.length > 0 ? sales.map(formatOrderLine).join("\n") : "- None on file"}
Their listings:
${listingLines}

If they ask about an order or listing, use these facts or call lookupOrder / listMyOrders / listMyListings. If several match, list them and ask which one. Do not volunteer unrelated orders.`
}
