import type { SupabaseClient } from "@supabase/supabase-js"
import type { LiveChatSessionRow } from "@/lib/db/liveChat"
import {
  claimLiveChatSessionEscalation,
  getLiveChatSessionById,
  isLiveChatEscalationClaimExpired,
  releaseLiveChatSessionEscalationClaim,
  updateLiveChatSessionRow,
} from "@/lib/db/liveChat"
import {
  getSupportCaseByContactMessageId,
  insertSupportCase,
  insertSupportCaseMessage,
  listSupportCaseMessages,
  touchSupportCaseAfterMessage,
} from "@/lib/db/supportCases"
import { liveChatCaseAlreadyHasVisitorTurn } from "@/lib/live-chat/team-display"

const LIVE_CHAT_CASE_SUBJECT = "Live chat"

export type OpenedLiveChatSupportCase = {
  supportCaseId: string
  contactMessageId: string
}

async function waitBriefly(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function resolveLinkedCase(
  svc: SupabaseClient,
  session: LiveChatSessionRow,
): Promise<OpenedLiveChatSupportCase | null> {
  if (session.support_case_id) {
    return {
      supportCaseId: session.support_case_id,
      contactMessageId: session.contact_message_id ?? "",
    }
  }
  if (!session.contact_message_id) return null

  const existing = await getSupportCaseByContactMessageId(svc, session.contact_message_id)
  if (!existing) return null

  await updateLiveChatSessionRow(svc, session.id, {
    support_case_id: existing.id,
    contact_message_id: session.contact_message_id,
  })
  return {
    supportCaseId: existing.id,
    contactMessageId: session.contact_message_id,
  }
}

/**
 * Soft-open a support case for live chat. Intentionally does NOT fire Klaviyo —
 * see `shouldNotifyKlaviyoOnLiveChatSoftOpen` in lib/live-chat/klaviyo-policy.ts.
 *
 * At most one case per live-chat session. Re-reads + claims so concurrent
 * visitor sends cannot open duplicate tickets.
 */
export async function openLiveChatSupportCase(
  svc: SupabaseClient,
  session: LiveChatSessionRow,
  opts?: { initialVisitorMessage?: string },
): Promise<OpenedLiveChatSupportCase | null> {
  const fresh = (await getLiveChatSessionById(svc, session.id)) ?? session
  const already = await resolveLinkedCase(svc, fresh)
  if (already) return already

  const email = (fresh.visitor_email ?? session.visitor_email)?.trim()
  if (!email) return null

  let claim = await claimLiveChatSessionEscalation(svc, session.id)
  if (claim.status === "already_linked") {
    return resolveLinkedCase(svc, claim.session)
  }
  if (claim.status === "in_progress") {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await waitBriefly(50)
      const polled = await getLiveChatSessionById(svc, session.id)
      if (!polled) return null
      const linked = await resolveLinkedCase(svc, polled)
      if (linked) return linked
      if (isLiveChatEscalationClaimExpired(polled)) break
    }
    claim = await claimLiveChatSessionEscalation(svc, session.id)
    if (claim.status === "already_linked") {
      return resolveLinkedCase(svc, claim.session)
    }
    if (claim.status !== "claimed") return null
  } else if (claim.status === "missing") {
    return null
  } else if (claim.status !== "claimed") {
    return null
  }

  const claimedSession = claim.session
  const preview =
    opts?.initialVisitorMessage?.trim() ||
    "Live chat conversation"

  try {
    const { data: ticket, error: ticketError } = await svc
      .from("contact_messages")
      .insert({
        name: claimedSession.visitor_name || session.visitor_name || "Reswell member",
        email,
        subject: LIVE_CHAT_CASE_SUBJECT,
        message: preview.slice(0, 4000),
        source: "live_chat",
        user_id: claimedSession.user_id ?? session.user_id,
        support_status: "new",
      })
      .select("id")
      .single()

    if (ticketError || !ticket?.id) {
      console.error("[liveChatSupportCase] contact_messages insert", ticketError)
      await releaseLiveChatSessionEscalationClaim(svc, claimedSession)
      return null
    }

    const opened = await insertSupportCase(svc, {
      kind: "general",
      subject: LIVE_CHAT_CASE_SUBJECT,
      preview: preview.slice(0, 500),
      requester_user_id: claimedSession.user_id ?? session.user_id,
      requester_email: email,
      requester_role: claimedSession.user_id || session.user_id ? "member" : "guest",
      contact_message_id: String(ticket.id),
      source_channel: "live_chat",
    })
    if (!opened.data) {
      await releaseLiveChatSessionEscalationClaim(svc, claimedSession)
      return null
    }

    if (opts?.initialVisitorMessage?.trim()) {
      await insertSupportCaseMessage(svc, {
        case_id: opened.data.id,
        author_user_id: claimedSession.user_id ?? session.user_id,
        author_role: "customer",
        body: opts.initialVisitorMessage.trim(),
      })
      await touchSupportCaseAfterMessage(svc, {
        id: opened.data.id,
        preview: opts.initialVisitorMessage.trim(),
        status: "in_progress",
      })
    } else {
      await touchSupportCaseAfterMessage(svc, {
        id: opened.data.id,
        preview,
        status: "in_progress",
      })
    }

    const linked = await updateLiveChatSessionRow(svc, session.id, {
      contact_message_id: String(ticket.id),
      support_case_id: opened.data.id,
    })
    if (!linked) {
      console.error("[liveChatSupportCase] failed to link support_case_id on session", session.id)
    }

    return {
      supportCaseId: opened.data.id,
      contactMessageId: String(ticket.id),
    }
  } catch (error) {
    console.error("[liveChatSupportCase] soft-open failed:", error)
    await releaseLiveChatSessionEscalationClaim(svc, claimedSession)
    return null
  }
}

export async function appendLiveChatVisitorTurnToCase(
  svc: SupabaseClient,
  caseId: string,
  session: LiveChatSessionRow,
  content: string,
): Promise<void> {
  const messages = await listSupportCaseMessages(svc, caseId, { includeInternal: true })
  if (liveChatCaseAlreadyHasVisitorTurn(messages, content)) return

  await insertSupportCaseMessage(svc, {
    case_id: caseId,
    author_user_id: session.user_id,
    author_role: "customer",
    body: content,
  })
  await touchSupportCaseAfterMessage(svc, { id: caseId, preview: content })
}

export async function appendLiveChatAgentTurnToCase(
  svc: SupabaseClient,
  caseId: string,
  body: string,
  opts?: { authorUserId?: string | null; isInternal?: boolean },
): Promise<void> {
  await insertSupportCaseMessage(svc, {
    case_id: caseId,
    author_user_id: opts?.authorUserId ?? null,
    author_role: opts?.isInternal ? "system" : "agent",
    body,
    is_internal: opts?.isInternal ?? false,
  })
  await touchSupportCaseAfterMessage(svc, {
    id: caseId,
    preview: body,
    status: "in_progress",
  })
}

/** Ensure a live-chat soft case exists, then append a visitor turn. */
export async function syncLiveChatVisitorMessageToCase(
  svc: SupabaseClient,
  session: LiveChatSessionRow,
  content: string,
): Promise<LiveChatSessionRow> {
  const opened = await openLiveChatSupportCase(svc, session, {
    initialVisitorMessage: content,
  })
  const caseId = opened?.supportCaseId ?? session.support_case_id
  if (!caseId) return session
  await appendLiveChatVisitorTurnToCase(svc, caseId, session, content)
  return {
    ...session,
    support_case_id: caseId,
    contact_message_id: opened?.contactMessageId || session.contact_message_id,
  }
}

/** Ensure a live-chat soft case exists, then append an agent turn. */
export async function syncLiveChatAgentMessageToCase(
  svc: SupabaseClient,
  session: LiveChatSessionRow,
  content: string,
  opts?: { authorUserId?: string | null },
): Promise<LiveChatSessionRow> {
  const opened = await openLiveChatSupportCase(svc, session)
  const caseId = opened?.supportCaseId ?? session.support_case_id
  if (!caseId) return session
  await appendLiveChatAgentTurnToCase(svc, caseId, content, {
    authorUserId: opts?.authorUserId,
  })
  return {
    ...session,
    support_case_id: caseId,
    contact_message_id: opened?.contactMessageId || session.contact_message_id,
  }
}
