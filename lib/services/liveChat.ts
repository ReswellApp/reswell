import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  getAgentDisplayNamesByIds,
  getLatestOpenLiveChatSessionForUser,
  getLiveChatSessionByPublicId,
  getLiveChatSessionForVisitor,
  insertLiveChatMessage,
  insertLiveChatSession,
  listLiveChatMessagesForSession,
  updateLiveChatSessionRow,
  type LiveChatMessageRow,
  type LiveChatSessionRow,
} from "@/lib/db/liveChat"
import { createLiveChatSessionSchema, sendLiveChatVisitorMessageSchema } from "@/lib/validations/liveChat"
import { generateLiveChatPublicId } from "@/lib/utils/live-chat-public-id"

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
      m.sender_type === "agent" && m.sender_agent_id
        ? (names.get(m.sender_agent_id) ?? "Support")
        : null,
  }))
}

export async function createOrResumeLiveChatSessionService(raw: unknown): Promise<
  | {
      success: true
      session: {
        id: string
        public_id: string
        visitor_name: string
        status: LiveChatSessionRow["status"]
      }
      messages: LiveChatVisitorMessage[]
    }
  | { error: string }
> {
  const parsed = createLiveChatSessionSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: "Invalid session request" }
  }

  const svc = createServiceRoleClient()
  const visitorName = parsed.data.visitor_name?.trim() || "Guest"

  if (parsed.data.resume_public_id) {
    const existing = await getLiveChatSessionForVisitor(
      svc,
      parsed.data.resume_public_id,
      parsed.data.visitor_token,
    )
    if (existing && existing.status !== "closed") {
      const messages = await enrichMessagesWithAgentNames(
        svc,
        await listLiveChatMessagesForSession(svc, existing.id),
      )
      return {
        success: true,
        session: {
          id: existing.id,
          public_id: existing.public_id,
          visitor_name: existing.visitor_name,
          status: existing.status,
        },
        messages,
      }
    }
  }

  const authSupabase = await createClient()
  const {
    data: { user },
  } = await authSupabase.auth.getUser()

  // Signed-in members resume their latest open chat across devices, even
  // without a stored public id. Adopt the current visitor token so
  // token-validated endpoints keep working from this browser.
  if (user?.id) {
    const existingForUser = await getLatestOpenLiveChatSessionForUser(svc, user.id)
    if (existingForUser) {
      if (existingForUser.visitor_token !== parsed.data.visitor_token) {
        await updateLiveChatSessionRow(svc, existingForUser.id, {
          visitor_token: parsed.data.visitor_token,
        })
      }
      const messages = await enrichMessagesWithAgentNames(
        svc,
        await listLiveChatMessagesForSession(svc, existingForUser.id),
      )
      return {
        success: true,
        session: {
          id: existingForUser.id,
          public_id: existingForUser.public_id,
          visitor_name: existingForUser.visitor_name,
          status: existingForUser.status,
        },
        messages,
      }
    }
  }

  const session = await insertLiveChatSession(svc, {
    public_id: generateLiveChatPublicId(),
    visitor_token: parsed.data.visitor_token,
    user_id: user?.id ?? null,
    visitor_name: visitorName,
    visitor_email: user?.email?.trim() || null,
  })

  if (!session) {
    return { error: "Could not start chat. Try again in a moment." }
  }

  const welcome = await insertLiveChatMessage(svc, {
    session_id: session.id,
    sender_type: "system",
    content: "Thanks for reaching out! A Reswell team member will be with you shortly.",
  })

  const messages: LiveChatVisitorMessage[] = welcome
    ? [{ ...welcome, agent_display_name: null }]
    : []

  return {
    success: true,
    session: {
      id: session.id,
      public_id: session.public_id,
      visitor_name: session.visitor_name,
      status: session.status,
    },
    messages,
  }
}

export async function sendLiveChatVisitorMessageService(
  publicId: string,
  raw: unknown,
): Promise<
  | { success: true; message: LiveChatMessageRow; session_id: string }
  | { error: string }
> {
  const parsed = sendLiveChatVisitorMessageSchema.safeParse(raw)
  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors.content?.[0] ?? "Invalid message"
    return { error: msg }
  }

  const svc = createServiceRoleClient()
  const session = await getLiveChatSessionForVisitor(svc, publicId, parsed.data.visitor_token)
  if (!session) {
    return { error: "Chat session not found." }
  }
  if (session.status === "closed" || session.status === "resolved") {
    return { error: "This chat is closed. Start a new conversation from the help button." }
  }

  if (parsed.data.visitor_name && parsed.data.visitor_name !== session.visitor_name) {
    await updateLiveChatSessionRow(svc, session.id, {
      visitor_name: parsed.data.visitor_name,
    })
  }

  if (parsed.data.visitor_email && parsed.data.visitor_email !== session.visitor_email) {
    await updateLiveChatSessionRow(svc, session.id, {
      visitor_email: parsed.data.visitor_email,
    })
  }

  const authSupabase = await createClient()
  const {
    data: { user },
  } = await authSupabase.auth.getUser()
  if (user?.id && !session.user_id) {
    await updateLiveChatSessionRow(svc, session.id, { user_id: user.id })
  }

  const message = await insertLiveChatMessage(svc, {
    session_id: session.id,
    sender_type: "visitor",
    content: parsed.data.content,
  })

  if (!message) {
    return { error: "Could not send message. Try again." }
  }

  if (session.status === "open") {
    await updateLiveChatSessionRow(svc, session.id, { status: "open" })
  }

  return { success: true, message, session_id: session.id }
}

export async function getLiveChatVisitorThreadService(
  publicId: string,
  visitorToken: string,
): Promise<
  | {
      success: true
      session: {
        id: string
        public_id: string
        visitor_name: string
        status: LiveChatSessionRow["status"]
      }
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
    await listLiveChatMessagesForSession(svc, session.id),
  )
  return {
    success: true,
    session: {
      id: session.id,
      public_id: session.public_id,
      visitor_name: session.visitor_name,
      status: session.status,
    },
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

export async function getLiveChatSessionIdByPublicId(publicId: string): Promise<string | null> {
  const svc = createServiceRoleClient()
  const session = await getLiveChatSessionByPublicId(svc, publicId)
  return session?.id ?? null
}
