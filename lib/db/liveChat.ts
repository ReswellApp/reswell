import type { SupabaseClient } from "@supabase/supabase-js"
import type { LiveChatSenderType, LiveChatSessionStatus } from "@/lib/validations/liveChat"

export type LiveChatSessionRow = {
  id: string
  public_id: string
  visitor_token: string
  user_id: string | null
  visitor_name: string
  visitor_email: string | null
  status: LiveChatSessionStatus
  assigned_agent_id: string | null
  contact_message_id: string | null
  last_message_at: string | null
  last_visitor_message_at: string | null
  last_agent_message_at: string | null
  created_at: string
  updated_at: string
  resolved_at: string | null
  metadata: Record<string, unknown>
}

export type LiveChatMessageRow = {
  id: string
  session_id: string
  sender_type: LiveChatSenderType
  sender_agent_id: string | null
  content: string
  created_at: string
}

export const LIVE_CHAT_SESSION_SELECT =
  "id, public_id, visitor_token, user_id, visitor_name, visitor_email, status, assigned_agent_id, contact_message_id, last_message_at, last_visitor_message_at, last_agent_message_at, created_at, updated_at, resolved_at, metadata"

export const LIVE_CHAT_MESSAGE_SELECT =
  "id, session_id, sender_type, sender_agent_id, content, created_at"

export function normalizeLiveChatSessionRow(raw: Record<string, unknown>): LiveChatSessionRow {
  return {
    id: String(raw.id),
    public_id: String(raw.public_id),
    visitor_token: String(raw.visitor_token),
    user_id: raw.user_id == null ? null : String(raw.user_id),
    visitor_name: String(raw.visitor_name ?? "Guest"),
    visitor_email: raw.visitor_email == null ? null : String(raw.visitor_email),
    status: (raw.status as LiveChatSessionStatus) ?? "open",
    assigned_agent_id: raw.assigned_agent_id == null ? null : String(raw.assigned_agent_id),
    contact_message_id: raw.contact_message_id == null ? null : String(raw.contact_message_id),
    last_message_at: raw.last_message_at == null ? null : String(raw.last_message_at),
    last_visitor_message_at:
      raw.last_visitor_message_at == null ? null : String(raw.last_visitor_message_at),
    last_agent_message_at:
      raw.last_agent_message_at == null ? null : String(raw.last_agent_message_at),
    created_at: String(raw.created_at ?? ""),
    updated_at: String(raw.updated_at ?? raw.created_at ?? ""),
    resolved_at: raw.resolved_at == null ? null : String(raw.resolved_at),
    metadata:
      raw.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata)
        ? (raw.metadata as Record<string, unknown>)
        : {},
  }
}

export function normalizeLiveChatMessageRow(raw: Record<string, unknown>): LiveChatMessageRow {
  return {
    id: String(raw.id),
    session_id: String(raw.session_id),
    sender_type: (raw.sender_type as LiveChatSenderType) ?? "visitor",
    sender_agent_id: raw.sender_agent_id == null ? null : String(raw.sender_agent_id),
    content: String(raw.content ?? ""),
    created_at: String(raw.created_at ?? ""),
  }
}

export async function getLiveChatSessionByPublicId(
  supabase: SupabaseClient,
  publicId: string,
): Promise<LiveChatSessionRow | null> {
  const { data, error } = await supabase
    .from("live_chat_sessions")
    .select(LIVE_CHAT_SESSION_SELECT)
    .eq("public_id", publicId)
    .maybeSingle()

  if (error || !data) return null
  return normalizeLiveChatSessionRow(data as Record<string, unknown>)
}

export async function getLiveChatSessionById(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<LiveChatSessionRow | null> {
  const { data, error } = await supabase
    .from("live_chat_sessions")
    .select(LIVE_CHAT_SESSION_SELECT)
    .eq("id", sessionId)
    .maybeSingle()

  if (error || !data) return null
  return normalizeLiveChatSessionRow(data as Record<string, unknown>)
}

export async function getLiveChatSessionForVisitor(
  supabase: SupabaseClient,
  publicId: string,
  visitorToken: string,
): Promise<LiveChatSessionRow | null> {
  const { data, error } = await supabase
    .from("live_chat_sessions")
    .select(LIVE_CHAT_SESSION_SELECT)
    .eq("public_id", publicId)
    .eq("visitor_token", visitorToken)
    .maybeSingle()

  if (error || !data) return null
  return normalizeLiveChatSessionRow(data as Record<string, unknown>)
}

/** Most recent open/assigned session for a signed-in member (cross-device resume). */
export async function getLatestOpenLiveChatSessionForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<LiveChatSessionRow | null> {
  const { data, error } = await supabase
    .from("live_chat_sessions")
    .select(LIVE_CHAT_SESSION_SELECT)
    .eq("user_id", userId)
    .in("status", ["open", "assigned"])
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return normalizeLiveChatSessionRow(data as Record<string, unknown>)
}

export async function insertLiveChatSession(
  supabase: SupabaseClient,
  row: {
    public_id: string
    visitor_token: string
    user_id?: string | null
    visitor_name: string
    visitor_email?: string | null
    contact_message_id?: string | null
  },
): Promise<LiveChatSessionRow | null> {
  const { data, error } = await supabase
    .from("live_chat_sessions")
    .insert({
      public_id: row.public_id,
      visitor_token: row.visitor_token,
      user_id: row.user_id ?? null,
      visitor_name: row.visitor_name,
      visitor_email: row.visitor_email ?? null,
      contact_message_id: row.contact_message_id ?? null,
      status: "open",
    })
    .select(LIVE_CHAT_SESSION_SELECT)
    .single()

  if (error || !data) {
    console.error("insertLiveChatSession", error)
    return null
  }
  return normalizeLiveChatSessionRow(data as Record<string, unknown>)
}

export async function updateLiveChatSessionRow(
  supabase: SupabaseClient,
  sessionId: string,
  patch: Partial<{
    visitor_name: string
    visitor_email: string | null
    visitor_token: string
    status: LiveChatSessionStatus
    assigned_agent_id: string | null
    contact_message_id: string | null
    resolved_at: string | null
    user_id: string | null
  }>,
): Promise<boolean> {
  const { error } = await supabase.from("live_chat_sessions").update(patch).eq("id", sessionId)
  if (error) {
    console.error("updateLiveChatSessionRow", error)
    return false
  }
  return true
}

export async function listOpenLiveChatSessions(
  supabase: SupabaseClient,
): Promise<LiveChatSessionRow[]> {
  const { data, error } = await supabase
    .from("live_chat_sessions")
    .select(LIVE_CHAT_SESSION_SELECT)
    .in("status", ["open", "assigned"])
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })

  if (error || !data) {
    console.error("listOpenLiveChatSessions", error)
    return []
  }
  return data.map((row) => normalizeLiveChatSessionRow(row as Record<string, unknown>))
}

/**
 * Signed-in sessions with no linked ticket whose last visitor message is older
 * than the cutoff. Agent-response filtering (column-to-column comparison) is
 * done by the caller since PostgREST cannot compare two columns.
 */
export async function listEscalationCandidateSessions(
  supabase: SupabaseClient,
  cutoffIso: string,
  limit = 100,
): Promise<LiveChatSessionRow[]> {
  const { data, error } = await supabase
    .from("live_chat_sessions")
    .select(LIVE_CHAT_SESSION_SELECT)
    .not("user_id", "is", null)
    .is("contact_message_id", null)
    .in("status", ["open", "assigned"])
    .not("last_visitor_message_at", "is", null)
    .lt("last_visitor_message_at", cutoffIso)
    .order("last_visitor_message_at", { ascending: true })
    .limit(limit)

  if (error || !data) {
    console.error("listEscalationCandidateSessions", error)
    return []
  }
  return data.map((row) => normalizeLiveChatSessionRow(row as Record<string, unknown>))
}

export async function countOpenLiveChatSessions(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase
    .from("live_chat_sessions")
    .select("*", { count: "exact", head: true })
    .in("status", ["open", "assigned"])

  if (error) return 0
  return count ?? 0
}

export async function listLiveChatMessagesForSession(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<LiveChatMessageRow[]> {
  const { data, error } = await supabase
    .from("live_chat_messages")
    .select(LIVE_CHAT_MESSAGE_SELECT)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })

  if (error || !data) {
    console.error("listLiveChatMessagesForSession", error)
    return []
  }
  return data.map((row) => normalizeLiveChatMessageRow(row as Record<string, unknown>))
}

export async function insertLiveChatMessage(
  supabase: SupabaseClient,
  row: {
    session_id: string
    sender_type: LiveChatSenderType
    sender_agent_id?: string | null
    content: string
  },
): Promise<LiveChatMessageRow | null> {
  const { data, error } = await supabase
    .from("live_chat_messages")
    .insert({
      session_id: row.session_id,
      sender_type: row.sender_type,
      sender_agent_id: row.sender_agent_id ?? null,
      content: row.content,
    })
    .select(LIVE_CHAT_MESSAGE_SELECT)
    .single()

  if (error || !data) {
    console.error("insertLiveChatMessage", error)
    return null
  }
  return normalizeLiveChatMessageRow(data as Record<string, unknown>)
}

export async function hasAgentMessagedInSession(
  supabase: SupabaseClient,
  sessionId: string,
  agentId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("live_chat_messages")
    .select("id")
    .eq("session_id", sessionId)
    .eq("sender_type", "agent")
    .eq("sender_agent_id", agentId)
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error("hasAgentMessagedInSession", error)
    return false
  }
  return Boolean(data)
}

export async function getAgentDisplayNamesByIds(
  supabase: SupabaseClient,
  agentIds: string[],
): Promise<Map<string, string>> {
  if (agentIds.length === 0) return new Map()
  const unique = [...new Set(agentIds)]
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", unique)

  if (error || !data) return new Map()
  const map = new Map<string, string>()
  for (const row of data) {
    const name = String(row.display_name ?? "").trim()
    map.set(String(row.id), name || "Support")
  }
  return map
}
