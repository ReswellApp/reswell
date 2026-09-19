import type { SupabaseClient } from "@supabase/supabase-js"
import {
  getLiveChatSessionById,
  insertLiveChatMessage,
  listRecentOpenLiveChatSessionsForUser,
  listRecentOpenLiveChatSessionsForVisitorToken,
  updateLiveChatSessionRow,
  type LiveChatSessionRow,
} from "@/lib/db/liveChat"
import { updateContactMessageRow } from "@/lib/db/contactMessages"
import {
  getSupportCaseById,
  insertSupportCaseEvent,
  insertSupportCaseMessage,
  touchSupportCaseAfterMessage,
  updateSupportCaseAdmin,
} from "@/lib/db/supportCases"
import {
  broadcastLiveChatMessage,
  broadcastLiveChatSessionStatus,
} from "@/lib/services/liveChatRealtime"

export const LIVE_CHAT_SOLVED_SYSTEM_MESSAGE =
  "This conversation looks solved, so we closed the ticket. Start a new chat anytime you need help."

export const LIVE_CHAT_STALE_SYSTEM_MESSAGE =
  "This chat went quiet, so we closed it. Start a new conversation anytime."

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
 * Resolve the support case (+ contact_messages sidecar) linked to a live chat.
 * Safe no-op when already resolved or nothing is linked.
 */
export async function resolveSupportTicketForLiveChatSession(
  svc: SupabaseClient,
  session: LiveChatSessionRow,
  note = LIVE_CHAT_SOLVED_SYSTEM_MESSAGE,
): Promise<void> {
  if (session.support_case_id) {
    const row = await getSupportCaseById(svc, session.support_case_id)
    if (row && row.status !== "resolved") {
      await updateSupportCaseAdmin(svc, { id: row.id, status: "resolved" })
      await insertSupportCaseEvent(svc, {
        case_id: row.id,
        event_type: "resolved",
        payload: { source: "live_chat", reason: "conversation_closed" },
      })
      await insertSupportCaseMessage(svc, {
        case_id: row.id,
        author_role: "system",
        body: note,
      })
      await touchSupportCaseAfterMessage(svc, {
        id: row.id,
        preview: note,
        status: "resolved",
      })
    }
  }

  if (session.contact_message_id) {
    await updateContactMessageRow(svc, {
      id: session.contact_message_id,
      support_status: "resolved",
    })
  }
}

/**
 * Solved-chat lifecycle: close the ticket first, then close the live chat session.
 * A fresh conversation (and ticket) only starts after this.
 */
export async function resolveLiveChatConversation(
  svc: SupabaseClient,
  session: LiveChatSessionRow,
  opts?: { note?: string; skipTicket?: boolean },
): Promise<boolean> {
  const note = opts?.note ?? LIVE_CHAT_SOLVED_SYSTEM_MESSAGE
  if (session.status === "closed" || session.status === "resolved") {
    if (!opts?.skipTicket) {
      await resolveSupportTicketForLiveChatSession(svc, session, note)
    }
    return true
  }

  if (!opts?.skipTicket) {
    await resolveSupportTicketForLiveChatSession(svc, session, note)
  }

  const ok = await updateLiveChatSessionRow(svc, session.id, {
    status: "resolved",
    resolved_at: new Date().toISOString(),
  })
  if (!ok) return false

  await insertAndBroadcastSystemMessage(svc, session.id, note)
  void broadcastLiveChatSessionStatus({ sessionId: session.id, status: "resolved" })
  return true
}

/**
 * Used by force_new / "Start a new conversation": close every open chat for this
 * visitor, resolving each linked ticket so the next chat mints a clean case.
 */
export async function closeOpenLiveChatConversationsForVisitor(
  svc: SupabaseClient,
  args: { userId?: string | null; visitorToken: string },
): Promise<number> {
  const open = args.userId
    ? await listRecentOpenLiveChatSessionsForUser(svc, args.userId, 20)
    : await listRecentOpenLiveChatSessionsForVisitorToken(svc, args.visitorToken, 20)

  let closed = 0
  for (const session of open) {
    const fresh = (await getLiveChatSessionById(svc, session.id)) ?? session
    if (await resolveLiveChatConversation(svc, fresh)) closed += 1
  }
  return closed
}
