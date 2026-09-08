import { after } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  closeOpenLiveChatSessionsForVisitor,
  getAgentDisplayNamesByIds,
  getLatestOpenLiveChatSessionForUser,
  getLiveChatSessionForVisitor,
  getVisitorDisplayNamesByIds,
  insertLiveChatMessage,
  insertLiveChatSession,
  listLiveChatMessagesForSession,
  updateLiveChatSessionRow,
  type LiveChatMessageRow,
  type LiveChatSessionRow,
} from "@/lib/db/liveChat"
import { createLiveChatSessionSchema, sendLiveChatVisitorMessageSchema } from "@/lib/validations/liveChat"
import { generateLiveChatPublicId } from "@/lib/utils/live-chat-public-id"
import {
  LIVE_CHAT_SESSION_CLOSED_CODE,
  LIVE_CHAT_SESSION_CLOSED_MESSAGE,
} from "@/lib/live-chat/errors"
import { broadcastLiveChatMessage } from "@/lib/services/liveChatRealtime"
import { escalateLiveChatSessionToTicket } from "@/lib/services/liveChatEscalation"

function isPlaceholderVisitorName(name: string | null | undefined): boolean {
  const trimmed = name?.trim() ?? ""
  return trimmed.length === 0 || trimmed.toLowerCase() === "guest"
}

async function resolveSignedInVisitorName(
  svc: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const names = await getVisitorDisplayNamesByIds(svc, [userId])
  return names.get(userId) ?? null
}

async function attachSignedInVisitorIdentity(
  svc: SupabaseClient,
  session: LiveChatSessionRow,
  user: { id: string; email?: string | null } | null,
): Promise<LiveChatSessionRow> {
  if (!user?.id) return session

  const patch: {
    user_id?: string
    visitor_name?: string
    visitor_email?: string | null
  } = {}

  if (!session.user_id) patch.user_id = user.id
  if (isPlaceholderVisitorName(session.visitor_name)) {
    const name = await resolveSignedInVisitorName(svc, user.id)
    if (name) patch.visitor_name = name
  }
  const email = user.email?.trim()
  if (email && !session.visitor_email) patch.visitor_email = email

  if (Object.keys(patch).length === 0) return session
  await updateLiveChatSessionRow(svc, session.id, patch)
  return { ...session, ...patch }
}

function toVisitorSession(session: LiveChatSessionRow) {
  return {
    id: session.id,
    public_id: session.public_id,
    visitor_name: session.visitor_name,
    status: session.status,
    support_case_id: session.support_case_id,
    assigned_agent_id: session.assigned_agent_id,
  }
}

export type LiveChatVisitorMessage = LiveChatMessageRow & {
  agent_display_name: string | null
}

/** Attach real agent names so the widget shows who replied, not just "Support". */
async function enrichMessagesWithAgentNames(
  svc: SupabaseClient,
  messages: LiveChatMessageRow[],
): Promise<LiveChatVisitorMessage[]> {
  const agentIds = messages
    .filter((m) => m.sender_type === "agent" && m.sender_agent_id)
    .map((m) => m.sender_agent_id as string)
  const names = await getAgentDisplayNamesByIds(svc, agentIds)
  return messages.map((m) => ({
    ...m,
    agent_display_name:
      m.sender_type === "bot"
        ? "Reswell AI"
        : m.sender_type === "agent" && m.sender_agent_id
          ? (names.get(m.sender_agent_id) ?? "Support")
          : null,
  }))
}

/** AI-only threads have no case/ticket and have not asked for a human. */
function isAiOnlyThread(session: LiveChatSessionRow): boolean {
  return (
    session.metadata.ai_mode === "active" &&
    session.metadata.ai_handoff_requested !== true &&
    !session.support_case_id &&
    !session.contact_message_id
  )
}

function sessionMatchesPrefer(
  session: LiveChatSessionRow,
  prefer: "ai" | "human" | "any",
): boolean {
  if (prefer === "ai") return isAiOnlyThread(session)
  if (prefer === "human") return !isAiOnlyThread(session)
  return true
}

/** Widget resume only needs recent context — not the full case archive. */
const VISITOR_RESUME_MESSAGE_LIMIT = 80

async function visitorResumePayload(
  svc: SupabaseClient,
  session: LiveChatSessionRow,
): Promise<{
  success: true
  session: ReturnType<typeof toVisitorSession>
  messages: LiveChatVisitorMessage[]
}> {
  const messages = await enrichMessagesWithAgentNames(
    svc,
    await listLiveChatMessagesForSession(svc, session.id, {
      limit: VISITOR_RESUME_MESSAGE_LIMIT,
    }),
  )
  return {
    success: true,
    session: toVisitorSession(session),
    messages,
  }
}

export async function createOrResumeLiveChatSessionService(raw: unknown): Promise<
  | {
      success: true
      session: ReturnType<typeof toVisitorSession>
      messages: LiveChatVisitorMessage[]
    }
  | { error: string }
> {
  const parsed = createLiveChatSessionSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: "Invalid session request" }
  }

  const svc = createServiceRoleClient()

  const authSupabase = await createClient()
  const {
    data: { user },
  } = await authSupabase.auth.getUser()

  const signedInName = user?.id ? await resolveSignedInVisitorName(svc, user.id) : null
  const clientName = parsed.data.visitor_name?.trim() || ""
  const visitorName =
    signedInName ||
    (!isPlaceholderVisitorName(clientName) ? clientName : "") ||
    "Guest"

  const forceNew = parsed.data.force_new === true
  const prefer = parsed.data.prefer ?? "any"

  if (forceNew) {
    await closeOpenLiveChatSessionsForVisitor(svc, {
      userId: user?.id ?? null,
      visitorToken: parsed.data.visitor_token,
    })
  }

  if (!forceNew && parsed.data.resume_public_id) {
    const existing = await getLiveChatSessionForVisitor(
      svc,
      parsed.data.resume_public_id,
      parsed.data.visitor_token,
    )
    // Resolved/closed chats stay in history; the visitor gets a fresh conversation.
    // Member-linked threads must not resume for anonymous visitors (or a different user)
    // even if localStorage still has the public id after sign-out.
    const canResumeAsCurrentVisitor =
      existing &&
      existing.status !== "closed" &&
      existing.status !== "resolved" &&
      (!existing.user_id || existing.user_id === user?.id) &&
      sessionMatchesPrefer(existing, prefer)
    if (canResumeAsCurrentVisitor && existing) {
      const attached = await attachSignedInVisitorIdentity(svc, existing, user)
      return visitorResumePayload(svc, attached)
    }
  }

  // Signed-in members resume their latest open chat across devices, even
  // without a stored public id. Adopt the current visitor token so
  // token-validated endpoints keep working from this browser.
  // "Talk to AI" (prefer=ai) must not snap into an open human/case thread.
  if (!forceNew && user?.id) {
    const existingForUser = await getLatestOpenLiveChatSessionForUser(svc, user.id)
    if (existingForUser && sessionMatchesPrefer(existingForUser, prefer)) {
      if (existingForUser.visitor_token !== parsed.data.visitor_token) {
        await updateLiveChatSessionRow(svc, existingForUser.id, {
          visitor_token: parsed.data.visitor_token,
        })
      }
      const attached = await attachSignedInVisitorIdentity(svc, {
        ...existingForUser,
        visitor_token: parsed.data.visitor_token,
      }, user)
      return visitorResumePayload(svc, attached)
    }
  }

  const session = await insertLiveChatSession(svc, {
    public_id: generateLiveChatPublicId(),
    visitor_token: parsed.data.visitor_token,
    user_id: user?.id ?? null,
    visitor_name: visitorName,
    visitor_email: user?.email?.trim() || null,
    metadata: prefer === "ai" ? { ai_mode: "active" } : undefined,
  })

  if (!session) {
    return { error: "Could not start chat. Try again in a moment." }
  }

  const welcome =
    prefer === "ai"
      ? null
      : await insertLiveChatMessage(svc, {
          session_id: session.id,
          sender_type: "system",
          content: "Thanks for reaching out! A Reswell team member will be with you shortly.",
        })

  const messages: LiveChatVisitorMessage[] = welcome
    ? [{ ...welcome, agent_display_name: null }]
    : []

  return {
    success: true,
    session: toVisitorSession(session),
    messages,
  }
}

export async function sendLiveChatVisitorMessageService(
  publicId: string,
  raw: unknown,
): Promise<
  | {
      success: true
      message: LiveChatMessageRow
      session_id: string
      support_case_id: string | null
    }
  | { error: string; code?: string }
> {
  const parsed = sendLiveChatVisitorMessageSchema.safeParse(raw)
  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors.content?.[0] ?? "Invalid message"
    return { error: msg }
  }

  const svc = createServiceRoleClient()
  let session = await getLiveChatSessionForVisitor(svc, publicId, parsed.data.visitor_token)
  if (!session) {
    return { error: "Chat session not found." }
  }
  if (session.status === "closed" || session.status === "resolved") {
    return { error: LIVE_CHAT_SESSION_CLOSED_MESSAGE, code: LIVE_CHAT_SESSION_CLOSED_CODE }
  }

  const authSupabase = await createClient()
  const {
    data: { user },
  } = await authSupabase.auth.getUser()

  session = await attachSignedInVisitorIdentity(svc, session, user)

  const clientName = parsed.data.visitor_name?.trim() || ""
  if (
    !user &&
    !isPlaceholderVisitorName(clientName) &&
    clientName !== session.visitor_name
  ) {
    await updateLiveChatSessionRow(svc, session.id, { visitor_name: clientName })
    session = { ...session, visitor_name: clientName }
  }

  if (parsed.data.visitor_email && parsed.data.visitor_email !== session.visitor_email) {
    await updateLiveChatSessionRow(svc, session.id, {
      visitor_email: parsed.data.visitor_email,
    })
    session = { ...session, visitor_email: parsed.data.visitor_email }
  }

  const message = await insertLiveChatMessage(svc, {
    session_id: session.id,
    sender_type: "visitor",
    content: parsed.data.content,
  })

  if (!message) {
    return { error: "Could not send message. Try again." }
  }

  const supportCaseId = session.support_case_id
  const visitorEmail = parsed.data.visitor_email?.trim() || session.visitor_email
  const shouldEscalate = !supportCaseId && Boolean(visitorEmail || session.user_id || user?.id)

  after(async () => {
    await broadcastLiveChatMessage({
      sessionId: session.id,
      message: {
        id: message.id,
        session_id: session.id,
        sender_type: "visitor",
        sender_agent_id: null,
        content: message.content,
        created_at: message.created_at,
      },
    })
    if (!shouldEscalate) return
    await escalateLiveChatSessionToTicket(
      svc,
      { ...session, visitor_email: visitorEmail, user_id: session.user_id ?? user?.id ?? null },
      "manual",
    )
  })

  return {
    success: true,
    message,
    session_id: session.id,
    support_case_id: supportCaseId,
  }
}

export async function getLiveChatVisitorThreadService(
  publicId: string,
  visitorToken: string,
): Promise<
  | {
      success: true
      session: ReturnType<typeof toVisitorSession>
      messages: LiveChatVisitorMessage[]
    }
  | { error: string }
> {
  const svc = createServiceRoleClient()
  const session = await getLiveChatSessionForVisitor(svc, publicId, visitorToken)
  if (!session) {
    return { error: "Chat session not found." }
  }

  const messages = await enrichMessagesWithAgentNames(
    svc,
    await listLiveChatMessagesForSession(svc, session.id, {
      limit: VISITOR_RESUME_MESSAGE_LIMIT,
    }),
  )
  return {
    success: true,
    session: toVisitorSession(session),
    messages,
  }
}

export async function validateLiveChatSessionAccess(
  publicId: string,
  visitorToken: string,
): Promise<LiveChatSessionRow | null> {
  const svc = createServiceRoleClient()
  return getLiveChatSessionForVisitor(svc, publicId, visitorToken)
}
