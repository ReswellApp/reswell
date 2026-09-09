import type { HelpHubIntentId, OrderHelpIssueId, SupportCaseKind } from "@/lib/types/supportCase"
import type { MessagesSupportTopic } from "@/lib/validations/messagesSupportTicket"

export type HelpHubIntent = {
  id: HelpHubIntentId
  title: string
  hint: string
  /** Maps to the existing messages-support journey topic when not order-specific. */
  topic?: MessagesSupportTopic
  priority?: boolean
}

export const HELP_HUB_INTENTS: readonly HelpHubIntent[] = [
  {
    id: "order",
    title: "An order or claim",
    hint: "Purchase, sale, cancel, or Purchase Protection",
  },
  {
    id: "buying_selling",
    title: "Buying or selling",
    hint: "Offers, listings, shipping — no order yet",
    topic: "buying_selling",
  },
  {
    id: "payments",
    title: "Payments & payouts",
    hint: "Checkout, wallet, cash out, fees",
    topic: "payments",
  },
  {
    id: "account",
    title: "Account & profile",
    hint: "Sign-in, profile, shop settings",
    topic: "account",
  },
  {
    id: "safety",
    title: "Safety or scam",
    hint: "Urgent — fraud, harassment, unsafe meetup",
    topic: "safety",
    priority: true,
  },
  {
    id: "general",
    title: "How Reswell works",
    hint: "Buying basics, fees, messages",
    topic: "general",
  },
  {
    id: "other",
    title: "Something else",
    hint: "Doesn’t fit the options above",
    topic: "other",
  },
] as const

export type OrderHelpIssue = {
  id: OrderHelpIssueId
  title: string
  hint: string
  /** Maps to order_support_requests.request_type */
  requestType: "help" | "cancel_order" | "refund_help"
  asksContactedSeller: boolean
}

export const ORDER_HELP_ISSUES: readonly OrderHelpIssue[] = [
  {
    id: "claim",
    title: "Start a Purchase Protection claim",
    hint: "Item not as described, damaged, missing, or never arrived",
    requestType: "refund_help",
    asksContactedSeller: true,
  },
  {
    id: "cancel",
    title: "Cancel this order",
    hint: "Before it ships or before pickup is completed",
    requestType: "cancel_order",
    asksContactedSeller: false,
  },
  {
    id: "question",
    title: "Question about this order",
    hint: "Tracking, address, timing, or anything else",
    requestType: "help",
    asksContactedSeller: false,
  },
] as const

export type SupportHubCategoryId =
  | "purchase"
  | "sale"
  | "claim"
  | "buying_selling"
  | "payments"
  | "account"
  | "safety"
  | "general"

export type SupportHubCategory = {
  id: SupportHubCategoryId
  title: string
  hint: string
  keywords: readonly string[]
  /** Same kind the admin inbox uses for this path. */
  adminKind: SupportCaseKind
  intent: HelpHubIntentId
  role?: "buyer" | "seller"
  issue?: OrderHelpIssueId
  featured?: boolean
}

/** Member-facing tiles — labels match admin case kinds where that helps triage. */
export const SUPPORT_HUB_CATEGORIES: readonly SupportHubCategory[] = [
  {
    id: "purchase",
    title: "A purchase",
    hint: "Tracking, cancel, or a problem with something you bought",
    keywords: ["order", "buy", "bought", "shipping", "delivery", "tracking", "cancel"],
    adminKind: "order_question",
    intent: "order",
    role: "buyer",
    featured: true,
  },
  {
    id: "sale",
    title: "A sale",
    hint: "Label, payout, or a buyer issue on something you sold",
    keywords: ["sale", "sold", "seller", "label", "payout", "ship"],
    adminKind: "order_question",
    intent: "order",
    role: "seller",
  },
  {
    id: "claim",
    title: "Purchase Protection",
    hint: "Damaged, not as described, missing, or never arrived",
    keywords: ["claim", "protection", "refund", "damage", "missing", "lost"],
    adminKind: "protection_claim",
    intent: "order",
    role: "buyer",
    issue: "claim",
  },
  {
    id: "payments",
    title: "Payments & payouts",
    hint: "Checkout, wallet, cash out, or fees",
    keywords: ["payment", "payout", "wallet", "cash out", "fee", "stripe", "charge"],
    adminKind: "payments",
    intent: "payments",
  },
  {
    id: "account",
    title: "Account & settings",
    hint: "Sign-in, profile, shop, or email",
    keywords: ["account", "login", "password", "profile", "shop", "email"],
    adminKind: "account",
    intent: "account",
  },
  {
    id: "buying_selling",
    title: "Buying or selling",
    hint: "Offers, listings, or shipping — no order yet",
    keywords: ["offer", "listing", "browse", "sell", "buy"],
    adminKind: "general",
    intent: "buying_selling",
  },
  {
    id: "safety",
    title: "Safety or scam",
    hint: "Fraud, harassment, or an unsafe meetup",
    keywords: ["safety", "scam", "fraud", "harassment", "report"],
    adminKind: "safety",
    intent: "safety",
  },
  {
    id: "general",
    title: "How Reswell works",
    hint: "Buying basics, fees, or something else",
    keywords: ["how", "faq", "general", "help", "other"],
    adminKind: "general",
    intent: "general",
  },
] as const

export function filterSupportHubCategories(
  query: string,
  categories: readonly SupportHubCategory[] = SUPPORT_HUB_CATEGORIES,
): SupportHubCategory[] {
  const q = query.trim().toLowerCase()
  if (!q) return [...categories]
  return categories.filter((category) => {
    const haystack = [category.title, category.hint, category.adminKind, ...category.keywords]
      .join(" ")
      .toLowerCase()
    return haystack.includes(q)
  })
}

export function supportHubHref(): string {
  return "/support"
}

export function parseHelpHubIntent(raw: string | undefined): HelpHubIntentId | null {
  if (!raw) return null
  return HELP_HUB_INTENTS.some((item) => item.id === raw) ? (raw as HelpHubIntentId) : null
}

export function parseOrderHelpIssue(raw: string | undefined): OrderHelpIssueId | null {
  if (raw === "question" || raw === "cancel" || raw === "claim") return raw
  return null
}

export function parseHelpHubRole(raw: string | undefined): "buyer" | "seller" | null {
  if (raw === "buyer" || raw === "seller") return raw
  return null
}

export function helpHubHref(args?: {
  intent?: HelpHubIntentId
  orderId?: string
  issue?: OrderHelpIssueId
  role?: "buyer" | "seller"
  conversationId?: string
}): string {
  const q = new URLSearchParams()
  if (args?.intent) q.set("intent", args.intent)
  if (args?.orderId) q.set("orderId", args.orderId)
  if (args?.issue) q.set("issue", args.issue)
  if (args?.role) q.set("role", args.role)
  if (args?.conversationId) q.set("conversationId", args.conversationId)
  const suffix = q.toString()
  return suffix ? `/dashboard/support?${suffix}` : "/dashboard/support"
}
