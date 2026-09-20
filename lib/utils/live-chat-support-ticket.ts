/**
 * Live-chat ticket rules: one open case per visitor, and the CS agent may
 * resolve that case only when the issue is actually solved.
 */

import { isLiveChatGreetingIntent } from "../live-chat/greeting-intent.ts"

export function isOpenLiveChatSupportStatus(status: string | null | undefined): boolean {
  return Boolean(status && status !== "resolved")
}

export function liveChatVisitorMatchesOpenCase(
  identity: { userId?: string | null; email?: string | null },
  ticket: {
    source_channel: string
    status: string
    requester_user_id?: string | null
    requester_email?: string | null
  },
): boolean {
  if (ticket.source_channel !== "live_chat") return false
  if (!isOpenLiveChatSupportStatus(ticket.status)) return false

  const userId = identity.userId?.trim() || null
  const email = identity.email?.trim().toLowerCase() || null
  if (userId && ticket.requester_user_id === userId) return true

  const ticketEmail = ticket.requester_email?.trim().toLowerCase() || null
  return Boolean(email && ticketEmail && email === ticketEmail)
}

const CONFIRMATION_ONLY =
  /^(thanks|thank you|thx|ok|okay|perfect|great|awesome|got it|that('s| is) (all|it)|resolved|solved)[!.,\s]*$/i
const STILL_WORKING =
  /\b(looking into|i('ll| will) (check|look|review)|let me (check|look|review)|follow up (shortly|here|soon)|we('re| are) looking)\b/i

export type HonorLiveChatTicketCloseArgs = {
  closeTicket: boolean
  reply: string
  lastCustomerMessage: string
  needsHumanReview: boolean
}

/**
 * Honor the model's close_ticket flag only when the reply is a finished answer.
 * Questions, "looking into it", greetings, and review-needed drafts stay open.
 */
export function shouldHonorLiveChatTicketClose(args: HonorLiveChatTicketCloseArgs): boolean {
  if (!args.closeTicket || args.needsHumanReview) return false

  const reply = args.reply.trim()
  if (!reply) return false
  if (/[?？]/.test(reply)) return false
  if (STILL_WORKING.test(reply)) return false

  const last = args.lastCustomerMessage.trim()
  if (last && isLiveChatGreetingIntent(last) && !CONFIRMATION_ONLY.test(last)) return false

  return true
}
