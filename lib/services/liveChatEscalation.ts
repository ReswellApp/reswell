import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  insertLiveChatMessage,
  listEscalationCandidateSessions,
  listLiveChatMessagesForSession,
  updateLiveChatSessionRow,
  type LiveChatSessionRow,
} from "@/lib/db/liveChat"

/** How long a signed-in chat can sit without an agent reply before it becomes a ticket. */
const AUTO_ESCALATE_AFTER_HOURS = 24

/** Cap the transcript embedded in the ticket so contact_messages stays readable. */
const TRANSCRIPT_MESSAGE_LIMIT = 30

type EscalationReason = "auto_unanswered" | "manual"

type EscalationResult =
  | { success: true; contactMessageId: string; alreadyLinked: boolean }
  | { error: string }

async function resolveMemberIdentity(
  svc: SupabaseClient,
  session: LiveChatSessionRow,
): Promise<{ name: string; email: string | null }> {
  let name = session.visitor_name || "Reswell member"
  let email = session.visitor_email?.trim() || null

  if (session.user_id) {
    const { data: profile } = await svc
      .from("profiles")
      .select("display_name")
      .eq("id", session.user_id)
      .maybeSingle()
    if (profile?.display_name && String(profile.display_name).trim()) {
      name = String(profile.display_name).trim()
    }

    if (!email) {
      const { data: authUser } = await svc.auth.admin.getUserById(session.user_id)
      email = authUser.user?.email?.trim() || null
    }
  }

  return { name, email }
}

async function buildTranscript(svc: SupabaseClient, sessionId: string): Promise<string> {
  const messages = await listLiveChatMessagesForSession(svc, sessionId)
  const conversational = messages.filter((m) => m.sender_type !== "system")
  const recent = conversational.slice(-TRANSCRIPT_MESSAGE_LIMIT)

  const lines = recent.map((m) => {
    const who = m.sender_type === "visitor" ? "Member" : "Reswell"
    return `${who}: ${m.content}`
  })
  if (conversational.length > recent.length) {
    lines.unshift(`… ${conversational.length - recent.length} earlier message(s) omitted`)
  }
  return lines.join("\n")
}

/**
 * Creates a support ticket (contact_messages) from a live chat session and links it back.
 * Idempotent: returns the existing ticket if the session is already linked.
 */
export async function escalateLiveChatSessionToTicket(
  svc: SupabaseClient,
  session: LiveChatSessionRow,
  reason: EscalationReason,
): Promise<EscalationResult> {
  if (session.contact_message_id) {
    return { success: true, contactMessageId: session.contact_message_id, alreadyLinked: true }
  }

  const { name, email } = await resolveMemberIdentity(svc, session)
  if (!email) {
    return { error: "No email on file for this chat — cannot create a ticket." }
  }

  const transcript = await buildTranscript(svc, session.id)
  if (!transcript) {
    return { error: "Chat has no messages to escalate." }
  }

  const subject =
    reason === "auto_unanswered"
      ? "Live chat — awaiting reply (auto-escalated)"
      : "Live chat — support case"

  const { data: ticket, error } = await svc
    .from("contact_messages")
    .insert({
      name,
      email,
      subject,
      message: transcript,
      source: "live_chat",
      user_id: session.user_id,
      support_status: "new",
    })
    .select("id")
    .single()

  if (error || !ticket?.id) {
    console.error("escalateLiveChatSessionToTicket", { sessionId: session.id, reason, error })
    return { error: "Failed to create support ticket." }
  }

  const contactMessageId = String(ticket.id)
  await updateLiveChatSessionRow(svc, session.id, { contact_message_id: contactMessageId })

  await insertLiveChatMessage(svc, {
    session_id: session.id,
    sender_type: "system",
    content:
      reason === "auto_unanswered"
        ? `We haven't gotten back to you yet, so we've opened a support case to make sure this doesn't slip through. We'll follow up at ${email}.`
        : `We've opened a support case for this conversation. We'll follow up at ${email}.`,
  })

  return { success: true, contactMessageId, alreadyLinked: false }
}

/**
 * Hourly cron entry point: escalates signed-in sessions with no agent reply
 * for AUTO_ESCALATE_AFTER_HOURS. Guest sessions are never auto-escalated.
 */
export async function escalateUnansweredLiveChatSessionsService(): Promise<{
  scanned: number
  escalated: number
  skipped: number
  failed: number
}> {
  const svc = createServiceRoleClient()
  const cutoffIso = new Date(Date.now() - AUTO_ESCALATE_AFTER_HOURS * 60 * 60 * 1000).toISOString()
  const candidates = await listEscalationCandidateSessions(svc, cutoffIso)

  let escalated = 0
  let skipped = 0
  let failed = 0

  for (const session of candidates) {
    // Only escalate when we have NOT replied since the member's last message.
    const answered =
      session.last_agent_message_at !== null &&
      session.last_visitor_message_at !== null &&
      new Date(session.last_agent_message_at).getTime() >=
        new Date(session.last_visitor_message_at).getTime()
    if (answered) {
      skipped += 1
      continue
    }

    const result = await escalateLiveChatSessionToTicket(svc, session, "auto_unanswered")
    if ("success" in result && result.success) {
      escalated += result.alreadyLinked ? 0 : 1
    } else {
      failed += 1
    }
  }

  return { scanned: candidates.length, escalated, skipped, failed }
}
