import type { SupabaseClient } from "@supabase/supabase-js"
import {
  insertLiveChatMessage,
  type LiveChatMessageRow,
  type LiveChatSessionRow,
} from "@/lib/db/liveChat"
import { isLiveChatShipFromLabelUpdateIntent } from "@/lib/live-chat/label-update-intent"
import {
  LIVE_CHAT_TEAM_NAME,
  LIVE_CHAT_WIDGET_ADMIN_ONLY,
} from "@/lib/live-chat/widget-config"
import {
  appendLiveChatAgentTurnToCase,
  appendLiveChatVisitorTurnToCase,
  openLiveChatSupportCase,
} from "@/lib/services/liveChatSupportCase"
import { bootstrapLiveChatLabelUpdate } from "@/lib/services/liveChatShipFromLabelUpdate"
import { broadcastLiveChatMessage, broadcastLiveChatTyping } from "@/lib/services/liveChatRealtime"
import { generateAndStoreDraft } from "@/lib/services/supportReplyDraft"
import { loadLiveChatReplyPromptBody } from "@/lib/services/supportReplyExamples"

const FALLBACK_REPLY =
  "Thanks for writing in — we're looking into this and will follow up here shortly."

/** Deterministic reply when eligible undropped-off sales exist (panel shows tiles). */
export const LIVE_CHAT_LABEL_UPDATE_REPLY =
  "You can update the ship-from address on a label for sales still waiting for carrier drop-off. Use the tiles below — pick the sale, say why, then choose the ship-from address. Ship-to stays the same."

/** When nothing is eligible — don't pin them in the label flow. */
export const LIVE_CHAT_LABEL_UPDATE_EMPTY_REPLY =
  "I don't see any of your sales with a label still waiting for carrier drop-off, so we can't reprint a ship-from label from here right now. If a label already scanned or the sale shipped, ship-from can't change. Tell me the order number or what else you need help with."

const DRAFT_GENERATE_BUDGET_MS = 10_000

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

async function generateDraftBodyWithBudget(
  svc: SupabaseClient,
  caseId: string,
): Promise<string | null> {
  try {
    const rewriteInstruction = await loadLiveChatReplyPromptBody(svc)
    const draft = await Promise.race([
      generateAndStoreDraft(svc, caseId, true, {
        rewriteInstruction,
        liveChatSession: session,
      }),
      new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), DRAFT_GENERATE_BUDGET_MS)
      }),
    ])
    if (draft && "data" in draft && draft.data.body.trim()) {
      return draft.data.body.trim()
    }
  } catch (error) {
    console.error("[liveChatCsAgentAutoReply] generate failed:", error)
  }
  return null
}

/**
 * Admin-widget only: the contact-messages CS agent writes the next reply and
 * sends it in live chat. Inbox drafts stay review-before-send.
 *
 * Label-update asks always get a deterministic team reply (even if a human is
 * assigned) so the visitor is never left with silence.
 */
export async function autoSendLiveChatCsAgentReply(
  svc: SupabaseClient,
  session: LiveChatSessionRow,
  visitorMessage: LiveChatMessageRow,
): Promise<LiveChatMessageRow | null> {
  if (!LIVE_CHAT_WIDGET_ADMIN_ONLY) return null

  const isLabelIntent = isLiveChatShipFromLabelUpdateIntent(visitorMessage.content)
  if (session.assigned_agent_id && !isLabelIntent) return null

  const opened = await openLiveChatSupportCase(svc, session, {
    initialVisitorMessage: visitorMessage.content,
  })
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
    if (isLabelIntent) {
      const bootstrap = await bootstrapLiveChatLabelUpdate({ svc, session })
      const body =
        !bootstrap.authRequired && bootstrap.orders.length === 0
          ? LIVE_CHAT_LABEL_UPDATE_EMPTY_REPLY
          : LIVE_CHAT_LABEL_UPDATE_REPLY
      return await persistTeamReply(svc, session, caseId, body)
    }

    let body = FALLBACK_REPLY
    if (caseId) {
      const generated = await generateDraftBodyWithBudget(svc, caseId)
      if (generated) body = generated
    }

    return await persistTeamReply(svc, session, caseId, body)
  } catch (error) {
    console.error("[liveChatCsAgentAutoReply] reply failed:", error)
    return persistTeamReply(
      svc,
      session,
      caseId,
      isLabelIntent ? LIVE_CHAT_LABEL_UPDATE_REPLY : FALLBACK_REPLY,
    )
  } finally {
    await broadcastLiveChatTyping({
      sessionId: session.id,
      participantType: "agent",
      displayName: LIVE_CHAT_TEAM_NAME,
      isTyping: false,
    })
  }
}
