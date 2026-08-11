import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { escalateLiveChatSessionToTicket } from "@/lib/services/liveChatEscalation"
import { formatPersonName } from "@/lib/utils/person-name"
import {
  countOpenLiveChatSessions,
  getAgentDisplayNamesByIds,
  getLiveChatSessionById,
  hasAgentMessagedInSession,
  insertLiveChatMessage,
  listLiveChatMessagesForSession,
  listOpenLiveChatSessions,
  updateLiveChatSessionRow,
  type LiveChatMessageRow,
  type LiveChatSessionRow,
} from "@/lib/db/liveChat"
import {
  escalateLiveChatSessionSchema,
  sendLiveChatAgentMessageSchema,
  updateLiveChatSessionAdminSchema,
} from "@/lib/validations/liveChat"

async function requireStaffUser(): Promise<
  { ok: true; userId: string; displayName: string } | { ok: false; error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, error: "Unauthorized" }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, is_employee, display_name, first_name, last_name")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile || (profile.is_admin !== true && profile.is_employee !== true)) {
    return { ok: false, error: "Forbidden" }
  }

  const displayName =
    formatPersonName(profile.first_name, profile.last_name, (profile.display_name ?? "").trim()) ||
    "Support"
  return { ok: true, userId: user.id, displayName }
}

export type LiveChatAdminMessage = LiveChatMessageRow & {
  agent_display_name: string | null
}

export type LiveChatAdminSession = LiveChatSessionRow & {
  assigned_agent_name: string | null
  preview: string | null
}

export async function listLiveChatAdminQueueService(): Promise<
  { success: true; sessions: LiveChatAdminSession[] } | { error: string }
> {
  const staff = await requireStaffUser()
  if (!staff.ok) return { error: staff.error }

  const supabase = await createClient()
  const sessions = await listOpenLiveChatSessions(supabase)
  const agentIds = sessions
    .map((s) => s.assigned_agent_id)
    .filter((id): id is string => Boolean(id))
  const agentNames = await getAgentDisplayNamesByIds(supabase, agentIds)

  const enriched: LiveChatAdminSession[] = []
  for (const session of sessions) {
    const messages = await listLiveChatMessagesForSession(supabase, session.id)
    const lastContent = messages.length > 0 ? messages[messages.length - 1]?.content : null
    enriched.push({
      ...session,
      assigned_agent_name: session.assigned_agent_id
        ? (agentNames.get(session.assigned_agent_id) ?? "Support")
        : null,
      preview: lastContent,
    })
  }

  return { success: true, sessions: enriched }
}

export async function loadLiveChatAdminThreadService(sessionId: string): Promise<
  | {
      success: true
      session: LiveChatAdminSession
      messages: LiveChatAdminMessage[]
    }
  | { error: string }
> {
  const staff = await requireStaffUser()
  if (!staff.ok) return { error: staff.error }

  const supabase = await createClient()
  const session = await getLiveChatSessionById(supabase, sessionId)
  if (!session) {
    return { error: "Session not found" }
  }

  const messages = await listLiveChatMessagesForSession(supabase, session.id)
  const agentIds = messages
    .map((m) => m.sender_agent_id)
    .filter((id): id is string => Boolean(id))
  if (session.assigned_agent_id) agentIds.push(session.assigned_agent_id)
  const agentNames = await getAgentDisplayNamesByIds(supabase, agentIds)

  const enrichedMessages: LiveChatAdminMessage[] = messages.map((m) => ({
    ...m,
    agent_display_name:
      m.sender_type === "bot"
        ? "Reswell AI"
        : m.sender_type === "agent" && m.sender_agent_id
          ? (agentNames.get(m.sender_agent_id) ?? "Support")
          : null,
  }))

  const lastContent = messages.length > 0 ? messages[messages.length - 1]?.content : null

  return {
    success: true,
    session: {
      ...session,
      assigned_agent_name: session.assigned_agent_id
        ? (agentNames.get(session.assigned_agent_id) ?? "Support")
        : null,
      preview: lastContent,
    },
    messages: enrichedMessages,
  }
}

export async function sendLiveChatAgentMessageService(raw: unknown): Promise<
  | {
      success: true
      message: LiveChatAdminMessage
      agent_display_name: string
      joined_message: LiveChatAdminMessage | null
    }
  | { error: string }
> {
  const parsed = sendLiveChatAgentMessageSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: "Invalid message" }
  }

  const staff = await requireStaffUser()
  if (!staff.ok) return { error: staff.error }

  const supabase = await createClient()
  const session = await getLiveChatSessionById(supabase, parsed.data.session_id)
  if (!session) {
    return { error: "Session not found" }
  }
  if (session.status === "closed") {
    return { error: "This chat is closed" }
  }

  // First reply from this agent in this session → announce who joined.
  let joinedMessage: LiveChatAdminMessage | null = null
  const alreadyInChat = await hasAgentMessagedInSession(supabase, session.id, staff.userId)
  if (!alreadyInChat) {
    const joined = await insertLiveChatMessage(supabase, {
      session_id: session.id,
      sender_type: "system",
      content: `${staff.displayName} joined the chat`,
    })
    if (joined) {
      joinedMessage = { ...joined, agent_display_name: null }
    }
  }

  const message = await insertLiveChatMessage(supabase, {
    session_id: session.id,
    sender_type: "agent",
    sender_agent_id: staff.userId,
    content: parsed.data.content,
  })

  if (!message) {
    return { error: "Failed to send message" }
  }

  const patch: Parameters<typeof updateLiveChatSessionRow>[2] = {}
  if (session.status === "open") {
    patch.status = "assigned"
    patch.assigned_agent_id = staff.userId
  } else if (!session.assigned_agent_id) {
    patch.assigned_agent_id = staff.userId
  }
  if (Object.keys(patch).length > 0) {
    await updateLiveChatSessionRow(supabase, session.id, patch)
  }

  return {
    success: true,
    message: { ...message, agent_display_name: staff.displayName },
    agent_display_name: staff.displayName,
    joined_message: joinedMessage,
  }
}

export async function updateLiveChatSessionAdminService(raw: unknown): Promise<
  { success: true } | { error: string }
> {
  const parsed = updateLiveChatSessionAdminSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: "Invalid input" }
  }

  const staff = await requireStaffUser()
  if (!staff.ok) return { error: staff.error }

  const supabase = await createClient()
  const session = await getLiveChatSessionById(supabase, parsed.data.session_id)
  if (!session) {
    return { error: "Session not found" }
  }

  const patch: Parameters<typeof updateLiveChatSessionRow>[2] = {}
  if (parsed.data.status !== undefined) {
    patch.status = parsed.data.status
    if (parsed.data.status === "resolved" || parsed.data.status === "closed") {
      patch.resolved_at = new Date().toISOString()
    }
  }
  if (parsed.data.assigned_agent_id !== undefined) {
    patch.assigned_agent_id = parsed.data.assigned_agent_id
    if (parsed.data.assigned_agent_id && session.status === "open") {
      patch.status = "assigned"
    }
  }

  if (Object.keys(patch).length === 0) {
    return { success: true }
  }

  const ok = await updateLiveChatSessionRow(supabase, session.id, patch)
  if (!ok) {
    return { error: "Failed to update session" }
  }

  if (patch.status === "resolved" || patch.status === "closed") {
    await insertLiveChatMessage(supabase, {
      session_id: session.id,
      sender_type: "system",
      content: "This conversation has been marked resolved. Start a new chat anytime you need help.",
    })
  }

  return { success: true }
}

/** Staff-initiated "open a case": converts a live chat into a support ticket. */
export async function escalateLiveChatSessionAdminService(raw: unknown): Promise<
  { success: true; contactMessageId: string } | { error: string }
> {
  const parsed = escalateLiveChatSessionSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: "Invalid input" }
  }

  const staff = await requireStaffUser()
  if (!staff.ok) return { error: staff.error }

  const supabase = await createClient()
  const session = await getLiveChatSessionById(supabase, parsed.data.session_id)
  if (!session) {
    return { error: "Session not found" }
  }
  if (session.contact_message_id) {
    return { success: true, contactMessageId: session.contact_message_id }
  }

  const svc = createServiceRoleClient()
  const result = await escalateLiveChatSessionToTicket(svc, session, "manual")
  if ("error" in result) {
    return { error: result.error }
  }
  return { success: true, contactMessageId: result.contactMessageId }
}

export async function countOpenLiveChatSessionsForAdminNav(): Promise<number> {
  try {
    const supabase = await createClient()
    return await countOpenLiveChatSessions(supabase)
  } catch {
    return 0
  }
}

export async function getLiveChatStaffProfileService(): Promise<
  { success: true; userId: string; displayName: string } | { error: string }
> {
  const staff = await requireStaffUser()
  if (!staff.ok) return { error: staff.error }
  return { success: true, userId: staff.userId, displayName: staff.displayName }
}
