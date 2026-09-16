import type { SupabaseClient } from "@supabase/supabase-js"
import type { LiveChatSessionRow } from "@/lib/db/liveChat"
import {
  insertSupportCase,
  insertSupportCaseMessage,
  listSupportCaseMessages,
  touchSupportCaseAfterMessage,
} from "@/lib/db/supportCases"
import { liveChatCaseAlreadyHasVisitorTurn } from "@/lib/live-chat/team-display"
import { LIVE_CHAT_TEAM_GREETING } from "@/lib/live-chat/widget-config"
import { updateLiveChatSessionRow } from "@/lib/db/liveChat"

const LIVE_CHAT_CASE_SUBJECT = "Live chat"

export type OpenedLiveChatSupportCase = {
  supportCaseId: string
  contactMessageId: string
}

export async function openLiveChatSupportCase(
  svc: SupabaseClient,
  session: LiveChatSessionRow,
): Promise<OpenedLiveChatSupportCase | null> {
  if (session.support_case_id) {
    return {
      supportCaseId: session.support_case_id,
      contactMessageId: session.contact_message_id ?? "",
    }
  }

  const email = session.visitor_email?.trim()
  if (!email) return null

  const { data: ticket, error: ticketError } = await svc
    .from("contact_messages")
    .insert({
      name: session.visitor_name || "Reswell member",
      email,
      subject: LIVE_CHAT_CASE_SUBJECT,
      message: LIVE_CHAT_TEAM_GREETING,
      source: "live_chat",
      user_id: session.user_id,
      support_status: "new",
    })
    .select("id")
    .single()

  if (ticketError || !ticket?.id) {
    console.error("[liveChatSupportCase] contact_messages insert", ticketError)
    return null
  }

  const opened = await insertSupportCase(svc, {
    kind: "general",
    subject: LIVE_CHAT_CASE_SUBJECT,
    preview: LIVE_CHAT_TEAM_GREETING,
    requester_user_id: session.user_id,
    requester_email: email,
    requester_role: session.user_id ? "member" : "guest",
    contact_message_id: String(ticket.id),
    source_channel: "live_chat",
  })
  if (!opened.data) return null

  await insertSupportCaseMessage(svc, {
    case_id: opened.data.id,
    author_role: "agent",
    body: LIVE_CHAT_TEAM_GREETING,
  })
  await touchSupportCaseAfterMessage(svc, {
    id: opened.data.id,
    preview: LIVE_CHAT_TEAM_GREETING,
    status: "in_progress",
  })

  await updateLiveChatSessionRow(svc, session.id, {
    contact_message_id: String(ticket.id),
    support_case_id: opened.data.id,
  })

  return {
    supportCaseId: opened.data.id,
    contactMessageId: String(ticket.id),
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
): Promise<void> {
  await insertSupportCaseMessage(svc, {
    case_id: caseId,
    author_role: "agent",
    body,
  })
  await touchSupportCaseAfterMessage(svc, {
    id: caseId,
    preview: body,
    status: "in_progress",
  })
}
