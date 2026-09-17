import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  claimLiveChatSessionEscalation,
  getLiveChatSessionById,
  insertLiveChatMessage,
  isLiveChatEscalationClaimExpired,
  releaseLiveChatSessionEscalationClaim,
  listEscalationCandidateSessions,
  listInactiveLiveChatSessions,
  listLiveChatMessagesForSession,
  listOpenLiveChatSessionsForContactMessages,
  listOpenLiveChatSessionsForSupportCases,
  updateLiveChatSessionRow,
  type LiveChatSessionRow,
} from "@/lib/db/liveChat"
import { createSupportCaseWithOpeningMessage } from "@/lib/services/supportCaseOpen"
import { ensureCaseForContactMessage } from "@/lib/services/supportCaseBackfill"
import { trackKlaviyoSupportTicketCreated } from "@/lib/klaviyo/track-support-ticket"
import { shouldNotifyKlaviyoOnLiveChatEscalation } from "@/lib/live-chat/klaviyo-policy"
import { broadcastLiveChatMessage, broadcastLiveChatSessionStatus } from "@/lib/services/liveChatRealtime"

/** How long a signed-in chat can sit without an agent reply before it becomes a ticket. */
const AUTO_ESCALATE_AFTER_HOURS = 24

/** How long a chat can be completely silent before it auto-resolves. */
const AUTO_RESOLVE_AFTER_DAYS = 7

const RESOLVED_SYSTEM_MESSAGE =
  "This conversation has been marked resolved. Start a new chat anytime you need help."

const INACTIVITY_SYSTEM_MESSAGE =
  "This conversation was closed due to inactivity. Start a new chat anytime you need help."

/** Cap the transcript embedded in the ticket so contact_messages stays readable. */
const TRANSCRIPT_MESSAGE_LIMIT = 30

type EscalationReason = "auto_unanswered" | "manual"

type EscalationResult =
  | {
      success: true
      contactMessageId: string
      supportCaseId: string | null
      alreadyLinked: boolean
    }
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
    const who =
      m.sender_type === "visitor"
        ? "Member"
        : m.sender_type === "bot"
          ? "Reswell AI"
          : "Reswell"
    return `${who}: ${m.content}`
  })
  if (conversational.length > recent.length) {
    lines.unshift(`… ${conversational.length - recent.length} earlier message(s) omitted`)
  }
  return lines.join("\n")
}

async function waitForLinkedSession(
  svc: SupabaseClient,
  sessionId: string,
): Promise<LiveChatSessionRow | null> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const row = await getLiveChatSessionById(svc, sessionId)
    if (row?.support_case_id && row.contact_message_id) return row
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  return getLiveChatSessionById(svc, sessionId)
}

async function insertAndBroadcastSystemMessage(
  svc: SupabaseClient,
  sessionId: string,
  content: string,
): Promise<void> {
  const message = await insertLiveChatMessage(svc, {
    session_id: sessionId,
    sender_type: "system",
    content,
  })
  if (!message) return
  void broadcastLiveChatMessage({
    sessionId,
    message: {
      id: message.id,
      session_id: sessionId,
      sender_type: "system",
      sender_agent_id: null,
      content: message.content,
      created_at: message.created_at,
    },
  })
}

/**
 * Opens (or resumes) the canonical support case for a live chat session.
 * Dual-writes contact_messages as a sidecar, same as other channels.
 */
export async function escalateLiveChatSessionToTicket(
  svc: SupabaseClient,
  session: LiveChatSessionRow,
  reason: EscalationReason,
): Promise<EscalationResult> {
  const fresh = (await getLiveChatSessionById(svc, session.id)) ?? session
  session = {
    ...fresh,
    visitor_email: session.visitor_email ?? fresh.visitor_email,
    user_id: session.user_id ?? fresh.user_id,
    visitor_name: session.visitor_name || fresh.visitor_name,
  }

  if (session.support_case_id && session.contact_message_id) {
    return {
      success: true,
      contactMessageId: session.contact_message_id,
      supportCaseId: session.support_case_id,
      alreadyLinked: true,
    }
  }

  const { name, email } = await resolveMemberIdentity(svc, session)
  if (!email) {
    return { error: "No email on file for this chat — cannot create a ticket." }
  }

  if (session.contact_message_id && !session.support_case_id) {
    const backfilled = await ensureCaseForContactMessage(svc, {
      id: session.contact_message_id,
      subject: "Live chat — support case",
      message: (await buildTranscript(svc, session.id)) || "Live chat",
      email,
      user_id: session.user_id,
      source: "live_chat",
    })
    if (backfilled) {
      await updateLiveChatSessionRow(svc, session.id, { support_case_id: backfilled.id })
    }
    return {
      success: true,
      contactMessageId: session.contact_message_id,
      supportCaseId: backfilled?.id ?? null,
      alreadyLinked: true,
    }
  }

  const transcript = await buildTranscript(svc, session.id)
  if (!transcript) {
    return { error: "Chat has no messages to escalate." }
  }

  let claim = await claimLiveChatSessionEscalation(svc, session.id)
  if (claim.status === "missing") {
    return { error: "Chat session not found." }
  }
  if (claim.status === "already_linked") {
    return {
      success: true,
      contactMessageId: claim.session.contact_message_id ?? "",
      supportCaseId: claim.session.support_case_id,
      alreadyLinked: true,
    }
  }
  if (claim.status === "in_progress") {
    const linked = await waitForLinkedSession(svc, session.id)
    if (linked?.contact_message_id) {
      return {
        success: true,
        contactMessageId: linked.contact_message_id,
        supportCaseId: linked.support_case_id,
        alreadyLinked: true,
      }
    }
    if (linked && !linked.support_case_id && isLiveChatEscalationClaimExpired(linked)) {
      await releaseLiveChatSessionEscalationClaim(svc, linked)
      const retried = await claimLiveChatSessionEscalation(svc, session.id)
      if (retried.status === "already_linked") {
        return {
          success: true,
          contactMessageId: retried.session.contact_message_id ?? "",
          supportCaseId: retried.session.support_case_id,
          alreadyLinked: true,
        }
      }
      if (retried.status === "claimed") {
        claim = retried
      } else {
        return { error: "Support case is already being opened." }
      }
    } else {
      return { error: "Support case is already being opened." }
    }
  }

  session = {
    ...claim.session,
    visitor_email: session.visitor_email ?? claim.session.visitor_email,
    user_id: session.user_id ?? claim.session.user_id,
    visitor_name: session.visitor_name || claim.session.visitor_name,
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
    await releaseLiveChatSessionEscalationClaim(svc, session)
    return { error: "Failed to create support ticket." }
  }

  const contactMessageId = String(ticket.id)
  const opened = await createSupportCaseWithOpeningMessage(svc, {
    kind: "general",
    subject,
    preview: transcript,
    requester_user_id: session.user_id,
    requester_email: email,
    requester_role: session.user_id ? "member" : "guest",
    contact_message_id: contactMessageId,
    source_channel: "live_chat",
    body: transcript,
    authorUserId: session.user_id,
  })

  await updateLiveChatSessionRow(svc, session.id, {
    contact_message_id: contactMessageId,
    support_case_id: opened?.id ?? null,
  })

  await insertAndBroadcastSystemMessage(
    svc,
    session.id,
    reason === "auto_unanswered"
      ? `We haven't gotten back to you yet, so we've opened a support case to make sure this doesn't slip through. We'll follow up at ${email}.`
      : `We've opened a support case for this conversation. We'll follow up at ${email}.`,
  )

  if (opened?.id && shouldNotifyKlaviyoOnLiveChatEscalation({ alreadyLinked: false, reason })) {
    void trackKlaviyoSupportTicketCreated({
      supportTicketId: opened.id,
      email,
      externalId: session.user_id,
      source: "live_chat",
      subject,
      message: transcript,
    })
  }

  return {
    success: true,
    contactMessageId,
    supportCaseId: opened?.id ?? null,
    alreadyLinked: false,
  }
}

async function resolveSessionWithNote(
  svc: SupabaseClient,
  sessionId: string,
  note: string,
): Promise<boolean> {
  const ok = await updateLiveChatSessionRow(svc, sessionId, {
    status: "resolved",
    resolved_at: new Date().toISOString(),
  })
  if (!ok) return false
  await insertAndBroadcastSystemMessage(svc, sessionId, note)
  void broadcastLiveChatSessionStatus({ sessionId, status: "resolved" })
  return true
}

/**
 * When support tickets are marked resolved, resolve any live chat sessions
 * linked to them so the visitor's next chat starts fresh. Fire-and-forget
 * safe: failures are logged, never thrown.
 */
export async function resolveLiveChatSessionsForTickets(
  contactMessageIds: string[],
): Promise<number> {
  try {
    const svc = createServiceRoleClient()
    const sessions = await listOpenLiveChatSessionsForContactMessages(svc, contactMessageIds)
    let resolved = 0
    for (const session of sessions) {
      if (await resolveSessionWithNote(svc, session.id, RESOLVED_SYSTEM_MESSAGE)) {
        resolved += 1
      }
    }
    return resolved
  } catch (error) {
    console.error("resolveLiveChatSessionsForTickets", { contactMessageIds, error })
    return 0
  }
}

export async function resolveLiveChatSessionsForCases(caseIds: string[]): Promise<number> {
  try {
    const svc = createServiceRoleClient()
    const sessions = await listOpenLiveChatSessionsForSupportCases(svc, caseIds)
    let resolved = 0
    for (const session of sessions) {
      if (await resolveSessionWithNote(svc, session.id, RESOLVED_SYSTEM_MESSAGE)) {
        resolved += 1
      }
    }
    return resolved
  } catch (error) {
    console.error("resolveLiveChatSessionsForCases", { caseIds, error })
    return 0
  }
}

/** Cron: resolves chats with no messages from anyone for AUTO_RESOLVE_AFTER_DAYS. */
export async function resolveInactiveLiveChatSessionsService(): Promise<{
  scanned: number
  resolved: number
}> {
  const svc = createServiceRoleClient()
  const cutoffIso = new Date(
    Date.now() - AUTO_RESOLVE_AFTER_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString()
  const sessions = await listInactiveLiveChatSessions(svc, cutoffIso)

  let resolved = 0
  for (const session of sessions) {
    if (await resolveSessionWithNote(svc, session.id, INACTIVITY_SYSTEM_MESSAGE)) {
      resolved += 1
    }
  }
  return { scanned: sessions.length, resolved }
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

    const aiActive = session.metadata.ai_mode === "active"
    const handoffRequested = session.metadata.ai_handoff_requested === true
    if (aiActive && !handoffRequested) {
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
