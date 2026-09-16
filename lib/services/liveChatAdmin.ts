import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { escalateLiveChatSessionToTicket } from "@/lib/services/liveChatEscalation"
import { broadcastLiveChatMessage } from "@/lib/services/liveChatRealtime"
import { formatPersonName } from "@/lib/utils/person-name"
import {
  countOpenLiveChatSessions,
  getAgentDisplayNamesByIds,
  getLiveChatSessionById,
  getVisitorDisplayNamesByIds,
  hasAgentMessagedInSession,
  insertLiveChatMessage,
  listLatestLiveChatMessagePreviews,
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

function isPlaceholderVisitorName(name: string | null | undefined): boolean {
  const trimmed = name?.trim() ?? ""
  return trimmed.length === 0 || trimmed.toLowerCase() === "guest"
}

async function applyMemberVisitorNames(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessions: LiveChatSessionRow[],
): Promise<LiveChatSessionRow[]> {
  const userIds = sessions
    .filter((session) => session.user_id && isPlaceholderVisitorName(session.visitor_name))
    .map((session) => session.user_id as string)
  if (userIds.length === 0) return sessions

  const names = await getVisitorDisplayNamesByIds(supabase, userIds)
  return Promise.all(
    sessions.map(async (session) => {
      const name = session.user_id ? names.get(session.user_id) : undefined
      if (!name || !isPlaceholderVisitorName(session.visitor_name)) return session
      await updateLiveChatSessionRow(supabase, session.id, { visitor_name: name })
      return { ...session, visitor_name: name }
    }),
  )
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
  const namedSessions = await applyMemberVisitorNames(supabase, sessions)
  const previews = await listLatestLiveChatMessagePreviews(
    supabase,
    namedSessions.map((session) => session.id),
  )

  const enriched: LiveChatAdminSession[] = namedSessions.map((session) => ({
    ...session,
    assigned_agent_name: session.assigned_agent_id
      ? (agentNames.get(session.assigned_agent_id) ?? "Support")
      : null,
    preview: previews.get(session.id) ?? null,
  }))

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
  const loaded = await getLiveChatSessionById(supabase, sessionId)
  if (!loaded) {
    return { error: "Session not found" }
  }
  const [session] = await applyMemberVisitorNames(supabase, [loaded])

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
  if (session.status === "closed" || session.status === "resolved") {
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

  if (joinedMessage) {
    void broadcastLiveChatMessage({
      sessionId: session.id,
      message: {
        id: joinedMessage.id,
        session_id: session.id,
        sender_type: "system",
        sender_agent_id: null,
        content: joinedMessage.content,
        created_at: joinedMessage.created_at,
      },
    })
  }
  void broadcastLiveChatMessage({
    sessionId: session.id,
    message: {
      id: message.id,
      session_id: session.id,
      sender_type: "agent",
      sender_agent_id: staff.userId,
      content: message.content,
      created_at: message.created_at,
      agent_display_name: staff.displayName,
    },
  })

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
  { success: true; contactMessageId: string; supportCaseId: string | null } | { error: string }
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

  const svc = createServiceRoleClient()
  const result = await escalateLiveChatSessionToTicket(svc, session, "manual")
  if ("error" in result) {
    return { error: result.error }
  }
  return {
    success: true,
    contactMessageId: result.contactMessageId,
    supportCaseId: result.supportCaseId,
  }
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
