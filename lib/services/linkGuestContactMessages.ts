import type { SupabaseClient } from "@supabase/supabase-js"
import {
  linkContactMessageToUser,
  listUnlinkedContactMessages,
  updateContactMessageRow,
  type UnlinkedContactMessageRow,
} from "@/lib/db/contactMessages"
import { ensureConversationBetweenBuyerAndSeller } from "@/lib/db/conversations"
import { findUserIdsByEmails } from "@/lib/services/resolveUserIdByEmail"
import { resolveSupportRecipientUserId } from "@/lib/services/resolveSupportRecipientUser"
import {
  formatSupportTicketOpeningMessage,
  insertMemberMessageInConversation,
  insertSupportStaffThreadMessage,
} from "@/lib/services/supportTicketThreadNotifications"
import { supportTicketDisplaySubject } from "@/lib/utils/support-ticket-display"

export type LinkGuestContactMessagesSummary = {
  scanned: number
  linked: number
  threads_created: number
  skipped_no_match: number
  skipped_invalid_email: number
  errors: number
}

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

function formatLinkedSupportThreadIntro(args: { ticketId: string; topic: string | null }): string {
  const topicLabel = args.topic?.trim() || "Support request"
  return [
    "Reswell support ticket",
    "",
    `Topic: ${topicLabel}`,
    "",
    "This chat is linked to your support request — our team can reply here anytime.",
    "",
    `Ticket ID: ${args.ticketId}`,
  ].join("\n")
}

async function ensureSupportThreadForLinkedTicket(
  supabase: SupabaseClient,
  ticket: UnlinkedContactMessageRow,
  memberId: string,
  supportUserId: string,
): Promise<{ created: boolean; error?: string }> {
  if (ticket.support_conversation_id) {
    return { created: false }
  }

  if (memberId === supportUserId) {
    return { created: false, error: "routing_conflict" }
  }

  const conv = await ensureConversationBetweenBuyerAndSeller(supabase, memberId, supportUserId)
  if (!conv?.id) {
    return { created: false, error: "conversation_create_failed" }
  }

  const conversationId = conv.id
  const { error: patchErr } = await updateContactMessageRow(supabase, {
    id: ticket.id,
    support_conversation_id: conversationId,
  })

  if (patchErr) {
    return { created: false, error: patchErr.message }
  }

  const topic = supportTicketDisplaySubject(ticket.subject, ticket.source)
  const intro = formatLinkedSupportThreadIntro({ ticketId: ticket.id, topic })
  const introPosted = await insertSupportStaffThreadMessage({
    conversationId,
    supportUserId,
    content: intro,
  })

  if (!introPosted.ok) {
    console.error("linkGuestContactMessages: intro message failed", ticket.id)
  }

  const openingBody = formatSupportTicketOpeningMessage({
    ticketId: ticket.id,
    topicLabel: topic,
    body: ticket.message.trim(),
  })
  const memberPosted = await insertMemberMessageInConversation(supabase, {
    conversationId,
    senderId: memberId,
    content: openingBody,
  })

  if (!memberPosted) {
    console.error("linkGuestContactMessages: opening ticket message failed", ticket.id)
  }

  return { created: true }
}

/**
 * Links guest contact_messages to member accounts when email matches profiles or Auth.
 * When support routing is configured, also creates the member ↔ support DM thread.
 */
export async function linkGuestContactMessages(
  supabase: SupabaseClient,
  options?: { batchSize?: number },
): Promise<LinkGuestContactMessagesSummary> {
  const batchSize = Math.min(Math.max(options?.batchSize ?? 100, 1), 250)
  const summary: LinkGuestContactMessagesSummary = {
    scanned: 0,
    linked: 0,
    threads_created: 0,
    skipped_no_match: 0,
    skipped_invalid_email: 0,
    errors: 0,
  }

  const tickets = await listUnlinkedContactMessages(supabase, batchSize)
  summary.scanned = tickets.length
  if (tickets.length === 0) {
    return summary
  }

  const ticketsByEmail = new Map<string, UnlinkedContactMessageRow[]>()
  for (const ticket of tickets) {
    const email = normalizeEmail(ticket.email)
    if (!email.includes("@")) {
      summary.skipped_invalid_email++
      continue
    }
    const list = ticketsByEmail.get(email) ?? []
    list.push(ticket)
    ticketsByEmail.set(email, list)
  }

  const userIdsByEmail = await findUserIdsByEmails(supabase, Array.from(ticketsByEmail.keys()))
  const resolvedSupport = await resolveSupportRecipientUserId()
  const supportUserId = resolvedSupport.ok ? resolvedSupport.userId : null

  for (const [email, emailTickets] of ticketsByEmail) {
    const userId = userIdsByEmail.get(email)
    if (!userId) {
      summary.skipped_no_match += emailTickets.length
      continue
    }

    for (const ticket of emailTickets) {
      const { error: linkErr } = await linkContactMessageToUser(supabase, ticket.id, userId)
      if (linkErr) {
        console.error("linkGuestContactMessages link", ticket.id, linkErr)
        summary.errors++
        continue
      }

      summary.linked++

      if (supportUserId) {
        const thread = await ensureSupportThreadForLinkedTicket(
          supabase,
          ticket,
          userId,
          supportUserId,
        )
        if (thread.error && thread.error !== "routing_conflict") {
          console.error("linkGuestContactMessages thread", ticket.id, thread.error)
        }
        if (thread.created) {
          summary.threads_created++
        }
      }
    }
  }

  return summary
}
