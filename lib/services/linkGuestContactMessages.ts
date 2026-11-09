import type { SupabaseClient } from "@supabase/supabase-js"
import {
  linkContactMessageToUser,
  listUnlinkedContactMessages,
  type UnlinkedContactMessageRow,
} from "@/lib/db/contactMessages"
import { findUserIdsByEmails } from "@/lib/services/resolveUserIdByEmail"
import { ensureContactMessageCaseOwnedByMember } from "@/lib/services/supportCaseBackfill"

export type LinkGuestContactMessagesSummary = {
  scanned: number
  linked: number
  cases_attached: number
  skipped_no_match: number
  skipped_invalid_email: number
  errors: number
}

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

/**
 * Links guest contact_messages to member accounts when email matches profiles or Auth,
 * and attaches the canonical support_cases row so the ticket appears under Help.
 * Does not create marketplace conversations or messages.
 */
export async function linkGuestContactMessages(
  supabase: SupabaseClient,
  options?: { batchSize?: number },
): Promise<LinkGuestContactMessagesSummary> {
  const batchSize = Math.min(Math.max(options?.batchSize ?? 100, 1), 250)
  const summary: LinkGuestContactMessagesSummary = {
    scanned: 0,
    linked: 0,
    cases_attached: 0,
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

      const attached = await ensureContactMessageCaseOwnedByMember(supabase, ticket, userId)
      if (attached) {
        summary.cases_attached++
      }
    }
  }

  return summary
}
