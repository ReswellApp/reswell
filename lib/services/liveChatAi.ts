/**
 * Reswell live chat AI — Help Center grounding + authenticated order tools.
 * Uses Vercel AI Gateway (same pattern as marketplace NL search).
 */

import { generateText, stepCountIs, tool } from "ai"
import { z } from "zod"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  getLiveChatSessionForVisitor,
  insertLiveChatMessage,
  listLiveChatMessagesForSession,
  mergeLiveChatSessionMetadata,
  updateLiveChatSessionRow,
  type LiveChatMessageRow,
  type LiveChatSessionRow,
} from "@/lib/db/liveChat"
import {
  listRecentLiveChatAiOrdersForMember,
  lookupLiveChatAiOrderForMember,
} from "@/lib/db/liveChatAiOrders"
import {
  formatKnowledgeChunksForPrompt,
  searchHelpArticles,
} from "@/lib/services/liveChatAiKnowledge"
import {
  liveChatAiRequestSchema,
  type LiveChatAiIntent,
} from "@/lib/validations/liveChatAi"
import { LIVE_CHAT_AI_OFFLINE_NOTE, RESEWELL_BOT_NAME } from "@/lib/live-chat/widget-config"
import {
  LIVE_CHAT_SESSION_CLOSED_CODE,
  LIVE_CHAT_SESSION_CLOSED_MESSAGE,
} from "@/lib/live-chat/errors"
import { broadcastLiveChatMessage } from "@/lib/services/liveChatRealtime"
import { areLiveChatAgentsOnlineService } from "@/lib/services/liveChatPresence"
import { escalateLiveChatSessionToTicket } from "@/lib/services/liveChatEscalation"

const MAX_AI_REPLIES_PER_SESSION = 40
const MAX_HISTORY_MESSAGES = 16

export const LIVE_CHAT_AI_WELCOME = "Great! How can I help?"

export const LIVE_CHAT_AI_HANDOFF_SYSTEM =
  "You've asked for a human teammate. We'll reply here — usually within one business day. Include an order number or listing link if you have one."

const OFFLINE_NOTE_PATTERN =
  /\n*—\s*\n*A Reswell teammate will also see this conversation and can follow up\.?/gi

/** Strip model-echoed offline notes, then append a single footer. */
export function withOfflineAssistFooter(text: string): string {
  const cleaned = text.replace(OFFLINE_NOTE_PATTERN, "").trim()
  const body =
    cleaned.length > 0
      ? cleaned
      : "I'm not sure I have a solid answer for that yet. Try rephrasing, or wait for a human teammate."
  return `${body}\n\n—\n${LIVE_CHAT_AI_OFFLINE_NOTE}`
}

type AiMode = "active" | "off" | undefined

function readAiMode(session: LiveChatSessionRow): AiMode {
  const value = session.metadata.ai_mode
  if (value === "active" || value === "off") return value
  return undefined
}

function isHandoffRequested(session: LiveChatSessionRow): boolean {
  return session.metadata.ai_handoff_requested === true
}

function decodeJwtPayload(token: string): { exp?: unknown } | null {
  const parts = token.split(".")
  if (parts.length < 2) return null
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/")
    const padded = b64.padEnd(Math.ceil(b64.length / 4) * 4, "=")
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as { exp?: unknown }
  } catch {
    return null
  }
}

/** Local `vercel env pull` OIDC tokens expire; an expired JWT is not usable auth. */
function isOidcTokenUsable(token: string): boolean {
  const payload = decodeJwtPayload(token)
  return typeof payload?.exp === "number" && payload.exp * 1000 > Date.now() + 30_000
}

function hasUsableGatewayAuth(): boolean {
  if (process.env.AI_GATEWAY_API_KEY?.trim()) return true
  const oidc = process.env.VERCEL_OIDC_TOKEN?.trim()
  return Boolean(oidc && isOidcTokenUsable(oidc))
}

export function isLiveChatAiEnabled(): boolean {
  if (process.env.LIVE_CHAT_AI_ENABLED === "false") return false
  return hasUsableGatewayAuth()
}

function knowledgeFallbackReply(query: string): string {
  const chunks = searchHelpArticles(query, 3)
  if (chunks.length === 0) {
    return "I couldn't pull a full answer just now. Try rephrasing, or wait for a teammate."
  }
  const lines = chunks.map((chunk) => {
    const snippet =
      chunk.body.length > 180 ? `${chunk.body.slice(0, 180).trim()}…` : chunk.body.trim()
    return `• ${chunk.title}: ${snippet}`
  })
  return `Here's what I can share from our help guides:\n\n${lines.join("\n\n")}`
}

function liveChatAiModelId(): string {
  return process.env.LIVE_CHAT_AI_MODEL?.trim() || "google/gemini-2.5-flash"
}

function countBotMessages(messages: LiveChatMessageRow[]): number {
  return messages.filter((m) => m.sender_type === "bot").length
}

function hasAgentReplied(messages: LiveChatMessageRow[]): boolean {
  return messages.some((m) => m.sender_type === "agent")
}

function toModelMessages(
  messages: LiveChatMessageRow[],
): Array<{ role: "user" | "assistant"; content: string }> {
  const conversational = messages.filter(
    (m) => m.sender_type === "visitor" || m.sender_type === "bot" || m.sender_type === "agent",
  )
  const recent = conversational.slice(-MAX_HISTORY_MESSAGES)
  return recent.map((m) => ({
    role: m.sender_type === "visitor" ? ("user" as const) : ("assistant" as const),
    content: m.content,
  }))
}

async function persistBotMessage(
  svc: SupabaseClient,
  sessionId: string,
  content: string,
): Promise<LiveChatMessageRow | null> {
  const message = await insertLiveChatMessage(svc, {
    session_id: sessionId,
    sender_type: "bot",
    content,
  })
  if (message) {
    void broadcastLiveChatMessage({
      sessionId,
      message: {
        id: message.id,
        session_id: sessionId,
        sender_type: "bot",
        sender_agent_id: null,
        content: message.content,
        created_at: message.created_at,
        agent_display_name: "Reswell AI",
      },
    })
  }
  return message
}

async function persistSystemMessage(
  svc: SupabaseClient,
  sessionId: string,
  content: string,
): Promise<LiveChatMessageRow | null> {
  const message = await insertLiveChatMessage(svc, {
    session_id: sessionId,
    sender_type: "system",
    content,
  })
  if (message) {
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
  return message
}

async function generateAiReply(options: {
  session: LiveChatSessionRow
  userId: string | null
  history: LiveChatMessageRow[]
  latestUserText: string
  offlineAssist: boolean
}): Promise<{ text: string; handoffRequested: boolean }> {
  const { session, userId, history, latestUserText, offlineAssist } = options
  let handoffRequested = false

  const seeded = searchHelpArticles(latestUserText, 4)
  const knowledgeBlock = formatKnowledgeChunksForPrompt(seeded)

  const signedInNote = userId
    ? "The visitor is signed in. You may use lookupOrder to fetch their order details."
    : "The visitor is not signed in. Do not invent order details; ask them to sign in to look up orders, or offer handoffToHuman."

  const system = `You are ${RESEWELL_BOT_NAME}, Reswell's support assistant for a peer-to-peer surf marketplace (boards, wetsuits, fins, and more).

Rules:
- Answer ONLY from retrieved help/FAQ knowledge and tool results. Never invent policies, fees, timelines, or order facts.
- Prefer clear, friendly, concise answers (2–6 short paragraphs or bullets).
- Cite helpful links when relevant (use the Source URLs from knowledge).
- If you are unsure, ask a clarifying question OR call handoffToHuman.
- Never process refunds, change payouts, or claim you completed an admin action.
- ${signedInNote}
${offlineAssist ? "- A human teammate is offline; still answer helpfully. Do NOT mention that a teammate will see the chat — the app adds that note separately." : ""}

Relevant Reswell knowledge (may be incomplete — use searchHelpArticles for more):
${knowledgeBlock}`

  const result = await generateText({
    model: liveChatAiModelId(),
    system,
    messages: [
      ...toModelMessages(history),
      { role: "user", content: latestUserText },
    ],
    stopWhen: stepCountIs(3),
    maxOutputTokens: 800,
    temperature: 0.3,
    tools: {
      searchHelpArticles: tool({
        description:
          "Search Reswell Help Center articles and FAQ for policies and how-to answers.",
        inputSchema: z.object({
          query: z.string().min(2).max(200).describe("Search query from the visitor question"),
        }),
        execute: async ({ query }) => {
          const chunks = searchHelpArticles(query, 5)
          return {
            results: chunks.map((c) => ({
              title: c.title,
              href: c.href,
              body: c.body,
              source: c.source,
            })),
          }
        },
      }),
      lookupOrder: tool({
        description:
          "Look up the signed-in member's order by order number, or list their recent orders if no number is provided.",
        inputSchema: z.object({
          orderNum: z
            .string()
            .trim()
            .min(1)
            .max(64)
            .optional()
            .describe("Order number if the visitor provided one"),
        }),
        execute: async ({ orderNum }) => {
          if (!userId) {
            return {
              ok: false as const,
              error: "Visitor is not signed in. Ask them to sign in to look up orders.",
            }
          }
          const svc = createServiceRoleClient()
          if (orderNum?.trim()) {
            const order = await lookupLiveChatAiOrderForMember(svc, userId, orderNum)
            if (!order) {
              return {
                ok: false as const,
                error: "No matching order found for this account.",
              }
            }
            return { ok: true as const, order }
          }
          const recent = await listRecentLiveChatAiOrdersForMember(svc, userId, 5)
          return { ok: true as const, recent_orders: recent }
        },
      }),
      handoffToHuman: tool({
        description:
          "Escalate to a human Reswell teammate when the visitor asks for a person, or when you cannot answer confidently.",
        inputSchema: z.object({
          reason: z.string().min(3).max(300).describe("Short reason for the handoff"),
        }),
        execute: async ({ reason }) => {
          handoffRequested = true
          console.info("[liveChatAi] handoff requested", {
            publicId: session.public_id,
            reason: reason.slice(0, 120),
          })
          return {
            ok: true as const,
            message:
              "Handoff recorded. Tell the visitor a human will follow up, and invite them to share order/listing details.",
          }
        },
      }),
    },
  })

  const text = result.text?.trim()
  if (!text) {
    return {
      text: "I'm not sure I have a solid answer for that yet. I can connect you with a Reswell teammate — just ask, or tap Talk to a human.",
      handoffRequested,
    }
  }
  return { text, handoffRequested }
}

export type LiveChatAiServiceResult =
  | {
      success: true
      session_id: string
      visitor_message: LiveChatMessageRow | null
      bot_message: LiveChatMessageRow | null
      system_message: LiveChatMessageRow | null
      ai_mode: "active" | "off"
      handoff: boolean
      support_case_id?: string | null
    }
  | { error: string; status?: number; code?: string }

async function ensureCaseOnHandoff(
  svc: SupabaseClient,
  session: LiveChatSessionRow,
): Promise<string | null> {
  if (session.support_case_id) return session.support_case_id
  if (!session.visitor_email && !session.user_id) return null
  const linked = await escalateLiveChatSessionToTicket(svc, session, "manual")
  return "success" in linked ? linked.supportCaseId : null
}

export async function liveChatAiService(publicId: string, raw: unknown): Promise<LiveChatAiServiceResult> {
  const parsed = liveChatAiRequestSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: "Invalid AI chat request", status: 400 }
  }

  const intent: LiveChatAiIntent = parsed.data.intent
  const content = parsed.data.content?.trim()
  const aiEnabled = isLiveChatAiEnabled()

  const svc = createServiceRoleClient()
  let session = await getLiveChatSessionForVisitor(svc, publicId, parsed.data.visitor_token)
  if (!session) {
    return { error: "Chat session not found.", status: 404 }
  }
  if (session.status === "closed" || session.status === "resolved") {
    return {
      error: LIVE_CHAT_SESSION_CLOSED_MESSAGE,
      code: LIVE_CHAT_SESSION_CLOSED_CODE,
      status: 409,
    }
  }

  const authSupabase = await createClient()
  const {
    data: { user },
  } = await authSupabase.auth.getUser()
  if (user?.id && !session.user_id) {
    await updateLiveChatSessionRow(svc, session.id, { user_id: user.id })
    session = { ...session, user_id: user.id }
  }
  const userId = session.user_id ?? user?.id ?? null

  if (intent === "handoff") {
    await mergeLiveChatSessionMetadata(svc, session, {
      ai_mode: "off",
      ai_handoff_requested: true,
    })
    const support_case_id = await ensureCaseOnHandoff(svc, session)
    const system_message = await persistSystemMessage(svc, session.id, LIVE_CHAT_AI_HANDOFF_SYSTEM)
    return {
      success: true,
      session_id: session.id,
      visitor_message: null,
      bot_message: null,
      system_message,
      ai_mode: "off",
      handoff: true,
      support_case_id,
    }
  }

  if (intent === "activate") {
    const alreadyActive = session.metadata?.ai_mode === "active"
    await mergeLiveChatSessionMetadata(svc, session, {
      ai_mode: "active",
      ai_handoff_requested: false,
    })
    session = {
      ...session,
      metadata: { ...session.metadata, ai_mode: "active", ai_handoff_requested: false },
    }

    // Skip a second welcome when AI is already on, or the thread already has bot replies
    // (e.g. offline assist / "I have another question" after a completed answer).
    const historyBeforeActivate = await listLiveChatMessagesForSession(svc, session.id)
    const hasPriorBotReply = countBotMessages(historyBeforeActivate) > 0
    let bot_message: LiveChatMessageRow | null =
      alreadyActive || hasPriorBotReply
        ? null
        : await persistBotMessage(svc, session.id, LIVE_CHAT_AI_WELCOME)
    let visitor_message: LiveChatMessageRow | null = null

    if (content) {
      visitor_message = await insertLiveChatMessage(svc, {
        session_id: session.id,
        sender_type: "visitor",
        content,
      })
      if (!visitor_message) {
        return { error: "Could not send message. Try again.", status: 500 }
      }

      const history = await listLiveChatMessagesForSession(svc, session.id)
      if (countBotMessages(history) > MAX_AI_REPLIES_PER_SESSION) {
        return { error: "AI reply limit reached for this chat. Please message the team.", status: 429 }
      }

      try {
        let text = knowledgeFallbackReply(content)
        let handoffRequested = false
        if (aiEnabled) {
          const started = Date.now()
          const generated = await generateAiReply({
            session,
            userId,
            history: history.filter((m) => m.id !== visitor_message!.id),
            latestUserText: content,
            offlineAssist: false,
          })
          text = generated.text
          handoffRequested = generated.handoffRequested
          console.info("[liveChatAi] reply", {
            publicId: session.public_id,
            intent,
            ms: Date.now() - started,
            handoffRequested,
          })
        }
        const reply = await persistBotMessage(svc, session.id, text)
        bot_message = reply ?? bot_message
        if (handoffRequested) {
          await mergeLiveChatSessionMetadata(svc, session, {
            ai_mode: "off",
            ai_handoff_requested: true,
          })
          const support_case_id = await ensureCaseOnHandoff(svc, session)
          const system_message = await persistSystemMessage(
            svc,
            session.id,
            LIVE_CHAT_AI_HANDOFF_SYSTEM,
          )
          return {
            success: true,
            session_id: session.id,
            visitor_message,
            bot_message,
            system_message,
            ai_mode: "off",
            handoff: true,
            support_case_id,
          }
        }
      } catch (err) {
        console.error("[liveChatAi] generate failed", err)
        const fallback = await persistBotMessage(
          svc,
          session.id,
          knowledgeFallbackReply(content),
        )
        bot_message = fallback ?? bot_message
      }
    }

    return {
      success: true,
      session_id: session.id,
      visitor_message,
      bot_message,
      system_message: null,
      ai_mode: "active",
      handoff: false,
    }
  }

  if (intent === "offline_assist") {
    const agentsOnline = await areLiveChatAgentsOnlineService()
    if (agentsOnline) {
      return { error: "Agents are online; offline assist skipped.", status: 409 }
    }
    if (
      readAiMode(session) === "off" ||
      isHandoffRequested(session) ||
      session.support_case_id ||
      session.contact_message_id
    ) {
      return { error: "AI assist is off for this chat.", status: 409 }
    }
    if (!content) {
      return { error: "Missing message content", status: 400 }
    }

    const history = await listLiveChatMessagesForSession(svc, session.id)
    if (hasAgentReplied(history) || isHandoffRequested(session)) {
      return { error: "A human is already handling this chat.", status: 409 }
    }
    if (countBotMessages(history) >= MAX_AI_REPLIES_PER_SESSION) {
      return { error: "AI reply limit reached for this chat.", status: 429 }
    }

    try {
      let text = knowledgeFallbackReply(content)
      let handoffRequested = false
      if (aiEnabled) {
        const started = Date.now()
        const generated = await generateAiReply({
          session,
          userId,
          history,
          latestUserText: content,
          offlineAssist: true,
        })
        text = generated.text
        handoffRequested = generated.handoffRequested
        console.info("[liveChatAi] offline_assist", {
          publicId: session.public_id,
          ms: Date.now() - started,
          handoffRequested,
        })
      }
      const bot_message = await persistBotMessage(svc, session.id, withOfflineAssistFooter(text))
      if (handoffRequested) {
        await mergeLiveChatSessionMetadata(svc, session, { ai_handoff_requested: true })
      }
      return {
        success: true,
        session_id: session.id,
        visitor_message: null,
        bot_message,
        system_message: null,
        ai_mode: readAiMode(session) === "active" ? "active" : "off",
        handoff: handoffRequested,
      }
    } catch (err) {
      console.error("[liveChatAi] offline_assist failed", err)
      const bot_message = await persistBotMessage(
        svc,
        session.id,
        withOfflineAssistFooter(knowledgeFallbackReply(content)),
      )
      return {
        success: true,
        session_id: session.id,
        visitor_message: null,
        bot_message,
        system_message: null,
        ai_mode: readAiMode(session) === "active" ? "active" : "off",
        handoff: false,
      }
    }
  }

  if (intent === "chat") {
    // Explicit AI send re-opens the bot unless a human teammate has already joined.
    if (readAiMode(session) !== "active" || isHandoffRequested(session)) {
      await mergeLiveChatSessionMetadata(svc, session, {
        ai_mode: "active",
        ai_handoff_requested: false,
      })
      session = {
        ...session,
        metadata: { ...session.metadata, ai_mode: "active", ai_handoff_requested: false },
      }
    }
    if (!content) {
      return { error: "Missing message content", status: 400 }
    }

    const historyBefore = await listLiveChatMessagesForSession(svc, session.id)
    if (hasAgentReplied(historyBefore)) {
      await mergeLiveChatSessionMetadata(svc, session, { ai_mode: "off" })
      return { error: "A human teammate has joined — continue in the team chat.", status: 409 }
    }
    if (countBotMessages(historyBefore) >= MAX_AI_REPLIES_PER_SESSION) {
      return { error: "AI reply limit reached for this chat. Please message the team.", status: 429 }
    }

    const visitor_message = await insertLiveChatMessage(svc, {
      session_id: session.id,
      sender_type: "visitor",
      content,
    })
    if (!visitor_message) {
      return { error: "Could not send message. Try again.", status: 500 }
    }

    try {
      let text = knowledgeFallbackReply(content)
      let handoffRequested = false
      if (aiEnabled) {
        const started = Date.now()
        const generated = await generateAiReply({
          session,
          userId,
          history: historyBefore,
          latestUserText: content,
          offlineAssist: false,
        })
        text = generated.text
        handoffRequested = generated.handoffRequested
        console.info("[liveChatAi] chat", {
          publicId: session.public_id,
          ms: Date.now() - started,
          handoffRequested,
        })
      }
      const bot_message = await persistBotMessage(svc, session.id, text)
      if (handoffRequested) {
        await mergeLiveChatSessionMetadata(svc, session, {
          ai_mode: "off",
          ai_handoff_requested: true,
        })
        const support_case_id = await ensureCaseOnHandoff(svc, session)
        const system_message = await persistSystemMessage(
          svc,
          session.id,
          LIVE_CHAT_AI_HANDOFF_SYSTEM,
        )
        return {
          success: true,
          session_id: session.id,
          visitor_message,
          bot_message,
          system_message,
          ai_mode: "off",
          handoff: true,
          support_case_id,
        }
      }
      return {
        success: true,
        session_id: session.id,
        visitor_message,
        bot_message,
        system_message: null,
        ai_mode: "active",
        handoff: false,
      }
    } catch (err) {
      console.error("[liveChatAi] chat failed", err)
      const bot_message = await persistBotMessage(
        svc,
        session.id,
        knowledgeFallbackReply(content),
      )
      return {
        success: true,
        session_id: session.id,
        visitor_message,
        bot_message,
        system_message: null,
        ai_mode: "active",
        handoff: false,
      }
    }
  }

  return { error: "Unsupported intent", status: 400 }
}
