import type { HelpHubIntentId, OrderHelpIssueId } from "@/lib/types/supportCase"
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

export function helpHubHref(args?: {
  intent?: HelpHubIntentId
  orderId?: string
  issue?: OrderHelpIssueId
  role?: "buyer" | "seller"
}): string {
  const q = new URLSearchParams()
  if (args?.intent) q.set("intent", args.intent)
  if (args?.orderId) q.set("orderId", args.orderId)
  if (args?.issue) q.set("issue", args.issue)
  if (args?.role) q.set("role", args.role)
  const suffix = q.toString()
  return suffix ? `/dashboard/support/new?${suffix}` : "/dashboard/support/new"
}
