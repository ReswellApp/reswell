import type { SupabaseClient } from "@supabase/supabase-js"
import {
  insertLiveChatMessage,
  type LiveChatMessageRow,
  type LiveChatSessionRow,
} from "@/lib/db/liveChat"
import { isLiveChatShipFromLabelUpdateIntent } from "@/lib/live-chat/label-update-intent"
import {
  isLiveChatSpecificOrderLookupIntent,
  liveChatOrderTileReplyForOrders,
} from "@/lib/live-chat/order-tile-intent"

import { LIVE_CHAT_UNGROUNDED_REPLY } from "@/lib/live-chat/live-chat-cs-prompt"
import { LIVE_CHAT_WIDGET_ADMIN_ONLY } from "@/lib/live-chat/widget-config"
import { liveChatPersonaAlreadyJoined } from "@/lib/live-chat/human-feel"
import {
  appendLiveChatAgentTurnToCase,
  appendLiveChatVisitorTurnToCase,
  openLiveChatSupportCase,
} from "@/lib/services/liveChatSupportCase"
import { bootstrapLiveChatLabelUpdate } from "@/lib/services/liveChatShipFromLabelUpdate"
import { listLiveChatVisitorOrderTiles } from "@/lib/services/liveChatVisitorOrders"
import { broadcastLiveChatMessage, broadcastLiveChatTyping } from "@/lib/services/liveChatRealtime"
import { resolveLiveChatConversation } from "@/lib/services/liveChatClose"
import { resolveLiveChatActionActor } from "@/lib/services/liveChatActionPolicy"
import { generateAndStoreDraft } from "@/lib/services/supportReplyDraft"
import { loadLiveChatReplyPromptBody } from "@/lib/services/supportReplyExamples"
import {
  announceLiveChatPersonaJoin,
  ensureLiveChatSessionPersona,
  holdLiveChatHumanFeel,
  liveChatRewriteWithPersona,
  sleepUntilLiveChatJoin,
} from "@/lib/services/liveChatHumanFeel"
import { routeLiveChatWriterWithJev } from "@/lib/llm/jev-live-chat-router"
import { liveChatCsAgentWriterModel } from "@/lib/live-chat/writer-route"
import { notifyLiveChatReplyViaKlaviyo } from "@/lib/services/liveChatKlaviyoReply"
import { shouldHonorLiveChatTicketClose } from "@/lib/utils/live-chat-support-ticket"

/** Outer budget covers order/listing preload plus the live-chat model timeout. */
const DRAFT_GENERATE_BUDGET_MS = 28_000

/** Deterministic reply when eligible undropped-off sales exist (panel shows tiles). */
export const LIVE_CHAT_LABEL_UPDATE_REPLY =
  "You can update the ship-from address on a label for sales still waiting for carrier drop-off. Use the tiles below — pick the sale, say why, then choose the ship-from address. Ship-to stays the same."

/** When nothing is eligible — don't pin them in the label flow. */
export const LIVE_CHAT_LABEL_UPDATE_EMPTY_REPLY =
  "I don't see any of your sales with a label still waiting for carrier drop-off, so we can't reprint a ship-from label from here right now. If a label already scanned or the sale shipped, ship-from can't change. Tell me the order number or what else you need help with."

/** Deterministic reply when this-order tiles are on screen. */
export const LIVE_CHAT_ORDER_TILE_REPLY =
  "Tap the order below and I'll look that one up."

async function persistTeamReply(
  svc: SupabaseClient,
  session: LiveChatSessionRow,
  caseId: string | null,
  body: string,
  displayName: string,
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
      agent_display_name: displayName,
    },
  })

  void notifyLiveChatReplyViaKlaviyo(svc, {
    session: { ...session, support_case_id: caseId ?? session.support_case_id },
    messageId: message.id,
    content: message.content,
  })

  return message
}

async function generateWithModel(
  svc: SupabaseClient,
  caseId: string,
  session: LiveChatSessionRow,
  rewriteInstruction: string,
  liveChatActor: Awaited<ReturnType<typeof resolveLiveChatActionActor>>,
  modelId: string,
): Promise<{ body: string; closeTicket: boolean } | null> {
  const draft = await Promise.race([
    generateAndStoreDraft(svc, caseId, true, {
      rewriteInstruction,
      liveChatSession: session,
      liveChatActor,
      modelId,
    }),
    new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), DRAFT_GENERATE_BUDGET_MS)
    }),
  ])
  const body = draft && "data" in draft ? draft.data.body.trim() : ""
  if (!body || body === LIVE_CHAT_UNGROUNDED_REPLY) return null
  return {
    body,
    closeTicket: draft !== null && "closeTicket" in draft && draft.closeTicket === true,
  }
}

async function generateDraftBodyWithBudget(
  svc: SupabaseClient,
  caseId: string,
  session: LiveChatSessionRow,
  firstName: string,
  visitorMessage: string,
): Promise<{ body: string; closeTicket: boolean } | null> {
  try {
    const route = await routeLiveChatWriterWithJev({
      visitorMessage,
      signedIn: Boolean(session.user_id),
    })
    const model = liveChatCsAgentWriterModel(route.writer)
    if (model !== route.model) {
      console.info(
        "[liveChatCsAgentAutoReply] writer",
        route.source,
        route.writer,
        "upgraded to",
        model,
        "— flash_lite cannot run CS agent tools + Output.object",
      )
    } else {
      console.info("[liveChatCsAgentAutoReply] writer", route.source, route.writer, model)
    }
    const rewriteInstruction = liveChatRewriteWithPersona(
      await loadLiveChatReplyPromptBody(svc),
      firstName,
    )
    const liveChatActor = await resolveLiveChatActionActor(svc, {
      visitorUserId: session.user_id,
    })
    const first = await generateWithModel(
      svc,
      caseId,
      session,
      rewriteInstruction,
      liveChatActor,
      model,
    )
    if (first) return first

    const pro = liveChatCsAgentWriterModel("pro")
    if (model !== pro) {
      console.warn("[liveChatCsAgentAutoReply] first writer empty, retrying with pro")
      const retry = await generateWithModel(
        svc,
        caseId,
        session,
        rewriteInstruction,
        liveChatActor,
        pro,
      )
      if (retry) return retry
    }
  } catch (error) {
    console.error("[liveChatCsAgentAutoReply] generate failed:", error)
  }
  return null
}

/**
 * Admin-widget only: the CS agent writes the next reply as Hayden or David,
 * after a join line and a human-feel delay. Inbox drafts stay review-before-send.
 *
 * Label-update asks always get a deterministic reply (even if a human is
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

  const startedAtMs = Date.now()
  const ensured = await ensureLiveChatSessionPersona(svc, session)
  let workingSession = ensured.session
  const persona = ensured.persona
  const isFirstJoin = !liveChatPersonaAlreadyJoined(workingSession.metadata)

  const generatePromise = (async () => {
    if (isLabelIntent) {
      const bootstrap = await bootstrapLiveChatLabelUpdate({ svc, session: workingSession })
      return {
        body:
          !bootstrap.authRequired && bootstrap.orders.length === 0
            ? LIVE_CHAT_LABEL_UPDATE_EMPTY_REPLY
            : LIVE_CHAT_LABEL_UPDATE_REPLY,
        closeTicket: false,
        needsHumanReview: false,
      }
    }

    if (isLiveChatSpecificOrderLookupIntent(visitorMessage.content)) {
      const tiles = await listLiveChatVisitorOrderTiles({ svc, session: workingSession })
      if (!tiles.authRequired && tiles.orders.length > 0) {
        return {
          body: liveChatOrderTileReplyForOrders(tiles.orders, visitorMessage.content),

          closeTicket: false,
          needsHumanReview: false,
        }
      }
    }

    const generated = caseId
      ? await generateDraftBodyWithBudget(
          svc,
          caseId,
          workingSession,
          persona.firstName,
          visitorMessage.content,
        )
      : null
    if (generated) return { ...generated, needsHumanReview: false }
    return {
      body: LIVE_CHAT_UNGROUNDED_REPLY,
      closeTicket: false,
      needsHumanReview: Boolean(caseId),
    }
  })()

  try {
    await sleepUntilLiveChatJoin({
      sessionId: workingSession.id,
      visitorContent: visitorMessage.content,
      isFirstJoin,
      startedAtMs,
    })

    if (isFirstJoin) {
      const announced = await announceLiveChatPersonaJoin(svc, workingSession, persona)
      workingSession = announced.session
    }

    await broadcastLiveChatTyping({
      sessionId: workingSession.id,
      participantType: "agent",
      displayName: persona.firstName,
      isTyping: true,
    })

    const generated = await generatePromise
    const body = generated.body
    const closeTicket = generated.closeTicket
    const needsHumanReview = generated.needsHumanReview

    await holdLiveChatHumanFeel({
      sessionId: workingSession.id,
      visitorContent: visitorMessage.content,
      replyContent: body,
      isFirstJoin,
      startedAtMs,
    })

    const sent = await persistTeamReply(svc, workingSession, caseId, body, persona.firstName)
    if (
      sent &&
      caseId &&
      shouldHonorLiveChatTicketClose({
        closeTicket,
        reply: body,
        lastCustomerMessage: visitorMessage.content,
        needsHumanReview,
      })
    ) {
      await resolveLiveChatConversation(svc, {
        ...workingSession,
        support_case_id: caseId,
        contact_message_id: opened?.contactMessageId || workingSession.contact_message_id,
      })
    }
    return sent
  } catch (error) {
    console.error("[liveChatCsAgentAutoReply] reply failed:", error)
    return persistTeamReply(
      svc,
      workingSession,
      caseId,
      isLabelIntent ? LIVE_CHAT_LABEL_UPDATE_REPLY : LIVE_CHAT_UNGROUNDED_REPLY,
      persona.firstName,
    )
  } finally {
    await broadcastLiveChatTyping({
      sessionId: workingSession.id,
      participantType: "agent",
      displayName: persona.firstName,
      isTyping: false,
    })
  }
}
