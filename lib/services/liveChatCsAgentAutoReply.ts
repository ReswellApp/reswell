import type { SupabaseClient } from "@supabase/supabase-js"
import {
  insertLiveChatMessage,
  type LiveChatMessageRow,
  type LiveChatSessionRow,
} from "@/lib/db/liveChat"
import {
  LIVE_CHAT_CS_AGENT_SEND_NOTE,
  LIVE_CHAT_TEAM_NAME,
  LIVE_CHAT_WIDGET_ADMIN_ONLY,
} from "@/lib/live-chat/widget-config"
import {
  appendLiveChatAgentTurnToCase,
  appendLiveChatVisitorTurnToCase,
  openLiveChatSupportCase,
} from "@/lib/services/liveChatSupportCase"
import { broadcastLiveChatMessage, broadcastLiveChatTyping } from "@/lib/services/liveChatRealtime"
import { generateAndStoreDraft } from "@/lib/services/supportReplyDraft"

const FALLBACK_REPLY =
  "Thanks for writing in — we're looking into this and will follow up here shortly."

async function persistTeamReply(
  svc: SupabaseClient,
  session: LiveChatSessionRow,
  caseId: string | null,
  body: string,
): Promise<LiveChatMessageRow | null> {
  const message = await insertLiveChatMessage(svc, {
    session_id: session.id,
    sender_type: "agent",
    sender_agent_id: null,
    content: body,
  })
  if (!message) return null

  if (caseId) {
    await appendLiveChatAgentTurnToCase(svc, caseId, body)
  }

  await broadcastLiveChatMessage({
    sessionId: session.id,
    message: {
      id: message.id,
      session_id: session.id,
      sender_type: "agent",
      sender_agent_id: null,
      content: message.content,
      created_at: message.created_at,
      agent_display_name: LIVE_CHAT_TEAM_NAME,
    },
  })

  return message
}

/**
 * Admin-widget only: the contact-messages CS agent writes the next reply and
 * sends it in live chat. Inbox drafts stay review-before-send.
 */
export async function autoSendLiveChatCsAgentReply(
  svc: SupabaseClient,
  session: LiveChatSessionRow,
  visitorMessage: LiveChatMessageRow,
): Promise<LiveChatMessageRow | null> {
  if (!LIVE_CHAT_WIDGET_ADMIN_ONLY) return null
  if (session.assigned_agent_id) return null

  const opened = await openLiveChatSupportCase(svc, session)
  const caseId = opened?.supportCaseId ?? session.support_case_id
  if (caseId) {
    await appendLiveChatVisitorTurnToCase(svc, caseId, session, visitorMessage.content)
  }

  await broadcastLiveChatTyping({
    sessionId: session.id,
    participantType: "agent",
    displayName: LIVE_CHAT_TEAM_NAME,
    isTyping: true,
  })

  try {
    let body = FALLBACK_REPLY
    if (caseId) {
      const draft = await generateAndStoreDraft(svc, caseId, true, {
        rewriteInstruction: LIVE_CHAT_CS_AGENT_SEND_NOTE,
      })
      if ("data" in draft && draft.data.body.trim()) {
        body = draft.data.body.trim()
      }
    }

    return await persistTeamReply(svc, session, caseId, body)
  } catch (error) {
    console.error("[liveChatCsAgentAutoReply] generate failed:", error)
    return persistTeamReply(svc, session, caseId, FALLBACK_REPLY)
  } finally {
    await broadcastLiveChatTyping({
      sessionId: session.id,
      participantType: "agent",
      displayName: LIVE_CHAT_TEAM_NAME,
      isTyping: false,
    })
  }
}
