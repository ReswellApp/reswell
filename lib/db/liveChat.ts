import type { SupabaseClient } from "@supabase/supabase-js"
import { formatPersonName } from "@/lib/utils/person-name"
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
  support_case_id: string | null
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

export const LIVE_CHAT_SESSION_SELECT_CORE =
  "id, public_id, visitor_token, user_id, visitor_name, visitor_email, status, assigned_agent_id, contact_message_id, last_message_at, last_visitor_message_at, last_agent_message_at, created_at, updated_at, resolved_at, metadata"

export const LIVE_CHAT_SESSION_SELECT = `${LIVE_CHAT_SESSION_SELECT_CORE}, support_case_id`

let liveChatSessionSelect = LIVE_CHAT_SESSION_SELECT

function isMissingSupportCaseColumn(error: { message?: string } | null | undefined): boolean {
  const message = error?.message ?? ""
  return message.includes("support_case_id") && message.includes("does not exist")
}

function liveChatSessionSelectColumns(): string {
  return liveChatSessionSelect
}

function noteMissingSupportCaseColumn(): void {
  liveChatSessionSelect = LIVE_CHAT_SESSION_SELECT_CORE
}

async function withSessionSelect<T>(
  run: (
    select: string,
  ) => PromiseLike<{ data: T; error: { message?: string } | null }>,
): Promise<{ data: T; error: { message?: string } | null }> {
  const first = await run(liveChatSessionSelectColumns())
  if (!first.error || !isMissingSupportCaseColumn(first.error)) return first
  noteMissingSupportCaseColumn()
  return run(liveChatSessionSelectColumns())
}

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
    support_case_id: raw.support_case_id == null ? null : String(raw.support_case_id),
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
  const { data, error } = await withSessionSelect((select) =>
    supabase.from("live_chat_sessions").select(select).eq("public_id", publicId).maybeSingle(),
  )

  if (error || !data) return null
  return normalizeLiveChatSessionRow(data as Record<string, unknown>)
}

export async function getLiveChatSessionById(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<LiveChatSessionRow | null> {
  const { data, error } = await withSessionSelect((select) =>
    supabase.from("live_chat_sessions").select(select).eq("id", sessionId).maybeSingle(),
  )

  if (error || !data) return null
  return normalizeLiveChatSessionRow(data as Record<string, unknown>)
}

export async function getLiveChatSessionForVisitor(
  supabase: SupabaseClient,
  publicId: string,
  visitorToken: string,
): Promise<LiveChatSessionRow | null> {
  const { data, error } = await withSessionSelect((select) =>
    supabase
      .from("live_chat_sessions")
      .select(select)
      .eq("public_id", publicId)
      .eq("visitor_token", visitorToken)
      .maybeSingle(),
  )

  if (error || !data) return null
  return normalizeLiveChatSessionRow(data as Record<string, unknown>)
}

export async function closeOpenLiveChatSessionsForVisitor(
  supabase: SupabaseClient,
  args: { userId?: string | null; visitorToken: string },
): Promise<void> {
  const now = new Date().toISOString()
  let query = supabase
    .from("live_chat_sessions")
    .update({ status: "closed", resolved_at: now })
    .in("status", ["open", "assigned"])
  query = args.userId
    ? query.eq("user_id", args.userId)
    : query.eq("visitor_token", args.visitorToken)
  const { error } = await query
  if (error) console.error("closeOpenLiveChatSessionsForVisitor", error)
}

/** Most recent open/assigned session for a signed-in member (cross-device resume). */
export async function getLatestOpenLiveChatSessionForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<LiveChatSessionRow | null> {
  const rows = await listRecentOpenLiveChatSessionsForUser(supabase, userId, 1)
  return rows[0] ?? null
}

/** Recent open/assigned sessions for a member, newest first. */
export async function listRecentOpenLiveChatSessionsForUser(
  supabase: SupabaseClient,
  userId: string,
  limit = 20,
): Promise<LiveChatSessionRow[]> {
  const { data, error } = await withSessionSelect((select) =>
    supabase
      .from("live_chat_sessions")
      .select(select)
      .eq("user_id", userId)
      .in("status", ["open", "assigned"])
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(limit),
  )

  if (error || !data) return []
  return data.map((row) => normalizeLiveChatSessionRow(row as Record<string, unknown>))
}

/** Recent open/assigned sessions for this browser visitor token (guest resume). */
export async function listRecentOpenLiveChatSessionsForVisitorToken(
  supabase: SupabaseClient,
  visitorToken: string,
  limit = 20,
): Promise<LiveChatSessionRow[]> {
  const { data, error } = await withSessionSelect((select) =>
    supabase
      .from("live_chat_sessions")
      .select(select)
      .eq("visitor_token", visitorToken)
      .in("status", ["open", "assigned"])
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(limit),
  )

  if (error || !data) return []
  return data.map((row) => normalizeLiveChatSessionRow(row as Record<string, unknown>))
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
    metadata?: Record<string, unknown>
  },
): Promise<LiveChatSessionRow | null> {
  const { data, error } = await withSessionSelect((select) =>
    supabase
      .from("live_chat_sessions")
      .insert({
        public_id: row.public_id,
        visitor_token: row.visitor_token,
        user_id: row.user_id ?? null,
        visitor_name: row.visitor_name,
        visitor_email: row.visitor_email ?? null,
        contact_message_id: row.contact_message_id ?? null,
        status: "open",
        ...(row.metadata ? { metadata: row.metadata } : {}),
      })
      .select(select)
      .single(),
  )

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
    support_case_id: string | null
    resolved_at: string | null
    user_id: string | null
    metadata: Record<string, unknown>
  }>,
): Promise<boolean> {
  const { error } = await supabase.from("live_chat_sessions").update(patch).eq("id", sessionId)
  if (error && isMissingSupportCaseColumn(error) && "support_case_id" in patch) {
    noteMissingSupportCaseColumn()
    const { support_case_id: _dropped, ...rest } = patch
    if (Object.keys(rest).length === 0) return true
    const retry = await supabase.from("live_chat_sessions").update(rest).eq("id", sessionId)
    if (!retry.error) return true
    console.error("updateLiveChatSessionRow", retry.error)
    return false
  }
  if (error) {
    console.error("updateLiveChatSessionRow", error)
    return false
  }
  return true
}

/** Merge keys into session.metadata without clobbering unrelated fields. */
export async function mergeLiveChatSessionMetadata(
  supabase: SupabaseClient,
  session: LiveChatSessionRow,
  patch: Record<string, unknown>,
): Promise<boolean> {
  return updateLiveChatSessionRow(supabase, session.id, {
    metadata: { ...session.metadata, ...patch },
  })
}

const OPEN_SESSION_PAGE_SIZE = 1000
const OPEN_SESSION_MAX_ROWS = 5000

export async function listOpenLiveChatSessions(
  supabase: SupabaseClient,
): Promise<LiveChatSessionRow[]> {
  const rows: LiveChatSessionRow[] = []
  for (let from = 0; from < OPEN_SESSION_MAX_ROWS; from += OPEN_SESSION_PAGE_SIZE) {
    const to = from + OPEN_SESSION_PAGE_SIZE - 1
    const { data, error } = await withSessionSelect((select) =>
      supabase
        .from("live_chat_sessions")
        .select(select)
        .in("status", ["open", "assigned"])
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .range(from, to),
    )

    if (error || !data) {
      if (from === 0) {
        console.error("listOpenLiveChatSessions", error)
        return []
      }
      break
    }
    rows.push(...data.map((row) => normalizeLiveChatSessionRow(row as Record<string, unknown>)))
    if (data.length < OPEN_SESSION_PAGE_SIZE) break
  }
  return rows
}

const ESCALATION_CLAIMED_AT_KEY = "escalation_claimed_at"
const ESCALATION_CLAIM_TTL_MS = 30_000

function escalationClaimAgeMs(raw: unknown): number | null {
  if (typeof raw !== "string") return null
  const parsed = Date.parse(raw)
  if (!Number.isFinite(parsed)) return null
  return Date.now() - parsed
}

export function isLiveChatEscalationClaimExpired(session: LiveChatSessionRow): boolean {
  const age = escalationClaimAgeMs(session.metadata[ESCALATION_CLAIMED_AT_KEY])
  return age !== null && age >= ESCALATION_CLAIM_TTL_MS
}

export type LiveChatEscalationClaim =
  | { status: "claimed"; session: LiveChatSessionRow }
  | { status: "already_linked"; session: LiveChatSessionRow }
  | { status: "in_progress"; session: LiveChatSessionRow }
  | { status: "missing" }

/** Compare-and-set so two visitor sends cannot both open a support case. */
export async function claimLiveChatSessionEscalation(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<LiveChatEscalationClaim> {
  const fresh = await getLiveChatSessionById(supabase, sessionId)
  if (!fresh) return { status: "missing" }
  if (fresh.support_case_id && fresh.contact_message_id) {
    return { status: "already_linked", session: fresh }
  }
  const claimAgeMs = escalationClaimAgeMs(fresh.metadata[ESCALATION_CLAIMED_AT_KEY])
  if (claimAgeMs !== null && claimAgeMs < ESCALATION_CLAIM_TTL_MS) {
    return { status: "in_progress", session: fresh }
  }
  if (claimAgeMs !== null) {
    await releaseLiveChatSessionEscalationClaim(supabase, fresh)
  }

  const claimedAt = new Date().toISOString()
  const nextMeta = { ...fresh.metadata, [ESCALATION_CLAIMED_AT_KEY]: claimedAt }
  const requireCaseColumn = liveChatSessionSelectColumns().includes("support_case_id")

  const runClaim = (select: string, filterCaseId: boolean) => {
    let query = supabase
      .from("live_chat_sessions")
      .update({ metadata: nextMeta })
      .eq("id", sessionId)
      .is("contact_message_id", null)
      .filter(`metadata->>${ESCALATION_CLAIMED_AT_KEY}`, "is", "null")
    if (filterCaseId) query = query.is("support_case_id", null)
    return query.select(select).maybeSingle()
  }

  let { data, error } = await runClaim(liveChatSessionSelectColumns(), requireCaseColumn)
  if (error && isMissingSupportCaseColumn(error)) {
    noteMissingSupportCaseColumn()
    ;({ data, error } = await runClaim(liveChatSessionSelectColumns(), false))
  }

  if (error) {
    console.error("claimLiveChatSessionEscalation", error)
    return { status: "missing" }
  }
  if (data) {
    return {
      status: "claimed",
      session: normalizeLiveChatSessionRow(data as Record<string, unknown>),
    }
  }

  const raced = await getLiveChatSessionById(supabase, sessionId)
  if (!raced) return { status: "missing" }
  if (raced.support_case_id && raced.contact_message_id) {
    return { status: "already_linked", session: raced }
  }
  return { status: "in_progress", session: raced }
}

/** Drop a failed claim so a later send or cron can retry. */
export async function releaseLiveChatSessionEscalationClaim(
  supabase: SupabaseClient,
  session: LiveChatSessionRow,
): Promise<void> {
  if (session.contact_message_id || session.support_case_id) return
  const { escalation_claimed_at: _dropped, ...rest } = session.metadata
  await updateLiveChatSessionRow(supabase, session.id, { metadata: rest })
}

const PREVIEW_SESSION_BATCH = 80

/** Latest message body per session — batched so PostgREST never silently truncates. */
export async function listLatestLiveChatMessagePreviews(
  supabase: SupabaseClient,
  sessionIds: string[],
): Promise<Map<string, string>> {
  const previews = new Map<string, string>()
  if (sessionIds.length === 0) return previews

  for (let i = 0; i < sessionIds.length; i += PREVIEW_SESSION_BATCH) {
    const batch = sessionIds.slice(i, i + PREVIEW_SESSION_BATCH)
    const { data, error } = await supabase
      .from("live_chat_messages")
      .select("session_id, content, created_at")
      .in("session_id", batch)
      .order("created_at", { ascending: false })
      .limit(Math.max(batch.length * 8, 40))

    if (error || !data) {
      if (error) console.error("listLatestLiveChatMessagePreviews", error)
      continue
    }

    for (const row of data) {
      const sessionId = String((row as { session_id?: unknown }).session_id ?? "")
      const content = String((row as { content?: unknown }).content ?? "").trim()
      if (!sessionId || previews.has(sessionId) || !content) continue
      previews.set(sessionId, content)
    }
  }
  return previews
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
  const run = (select: string, filterCaseId: boolean) => {
    let q = supabase
      .from("live_chat_sessions")
      .select(select)
      .not("user_id", "is", null)
      .is("contact_message_id", null)
      .in("status", ["open", "assigned"])
      .not("last_visitor_message_at", "is", null)
      .lt("last_visitor_message_at", cutoffIso)
      .order("last_visitor_message_at", { ascending: true })
      .limit(limit)
    if (filterCaseId) q = q.is("support_case_id", null)
    return q
  }

  let { data, error } = await run(liveChatSessionSelectColumns(), liveChatSessionSelectColumns().includes("support_case_id"))
  if (error && isMissingSupportCaseColumn(error)) {
    noteMissingSupportCaseColumn()
    ;({ data, error } = await run(liveChatSessionSelectColumns(), false))
  }

  if (error || !data) {
    console.error("listEscalationCandidateSessions", error)
    return []
  }
  return data.map((row) => normalizeLiveChatSessionRow(row as Record<string, unknown>))
}

/** Clear case + ticket pointers on every session except `keepSessionId` so the unique link can move. */
export async function detachOtherLiveChatSessionsFromSupportCase(
  supabase: SupabaseClient,
  caseId: string,
  keepSessionId: string,
): Promise<void> {
  if (!caseId || !keepSessionId) return
  const { error } = await supabase
    .from("live_chat_sessions")
    .update({ support_case_id: null, contact_message_id: null })
    .eq("support_case_id", caseId)
    .neq("id", keepSessionId)
  if (error) {
    console.error("detachOtherLiveChatSessionsFromSupportCase", error)
  }
}

/** Open/assigned sessions linked to the given support cases. */
export async function listOpenLiveChatSessionsForSupportCases(
  supabase: SupabaseClient,
  caseIds: string[],
): Promise<LiveChatSessionRow[]> {
  if (caseIds.length === 0) return []
  if (!liveChatSessionSelectColumns().includes("support_case_id")) return []
  const { data, error } = await supabase
    .from("live_chat_sessions")
    .select(liveChatSessionSelectColumns())
    .in("support_case_id", caseIds)
    .in("status", ["open", "assigned"])

  if (error || !data) {
    if (error) console.error("listOpenLiveChatSessionsForSupportCases", error)
    return []
  }
  return data.map((row) => normalizeLiveChatSessionRow(row as Record<string, unknown>))
}

/** Latest open/assigned live chat linked to a support case (desk deep-link). */
export async function getOpenLiveChatSessionBySupportCaseId(
  supabase: SupabaseClient,
  caseId: string,
): Promise<LiveChatSessionRow | null> {
  const rows = await listOpenLiveChatSessionsForSupportCases(supabase, [caseId])
  return rows[0] ?? null
}

/** Open/assigned sessions linked to the given support tickets. */
export async function listOpenLiveChatSessionsForContactMessages(
  supabase: SupabaseClient,
  contactMessageIds: string[],
): Promise<LiveChatSessionRow[]> {
  if (contactMessageIds.length === 0) return []
  const { data, error } = await withSessionSelect((select) =>
    supabase
      .from("live_chat_sessions")
      .select(select)
      .in("contact_message_id", contactMessageIds)
      .in("status", ["open", "assigned"]),
  )

  if (error || !data) {
    if (error) console.error("listOpenLiveChatSessionsForContactMessages", error)
    return []
  }
  return data.map((row) => normalizeLiveChatSessionRow(row as Record<string, unknown>))
}

/** Open/assigned sessions with no activity at all since the cutoff. */
export async function listInactiveLiveChatSessions(
  supabase: SupabaseClient,
  cutoffIso: string,
  limit = 200,
): Promise<LiveChatSessionRow[]> {
  const { data, error } = await withSessionSelect((select) =>
    supabase
      .from("live_chat_sessions")
      .select(select)
      .in("status", ["open", "assigned"])
      .not("last_message_at", "is", null)
      .lt("last_message_at", cutoffIso)
      .order("last_message_at", { ascending: true })
      .limit(limit),
  )

  if (error || !data) {
    if (error) console.error("listInactiveLiveChatSessions", error)
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
  options?: { limit?: number },
): Promise<LiveChatMessageRow[]> {
  const limit = options?.limit
  let query = supabase
    .from("live_chat_messages")
    .select(LIVE_CHAT_MESSAGE_SELECT)
    .eq("session_id", sessionId)

  query =
    limit && limit > 0
      ? query.order("created_at", { ascending: false }).limit(limit)
      : query.order("created_at", { ascending: true })

  const { data, error } = await query

  if (error || !data) {
    console.error("listLiveChatMessagesForSession", error)
    return []
  }
  const rows = data.map((row) => normalizeLiveChatMessageRow(row as Record<string, unknown>))
  return limit && limit > 0 ? rows.reverse() : rows
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

export async function getVisitorDisplayNamesByIds(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map()
  const unique = [...new Set(userIds)]
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, first_name, last_name")
    .in("id", unique)

  if (error || !data) return new Map()
  const map = new Map<string, string>()
  for (const row of data) {
    const name = formatPersonName(
      row.first_name as string | null,
      row.last_name as string | null,
      String(row.display_name ?? "").trim(),
    )
    if (name) map.set(String(row.id), name)
  }
  return map
}

export async function getAgentDisplayNamesByIds(
  supabase: SupabaseClient,
  agentIds: string[],
): Promise<Map<string, string>> {
  if (agentIds.length === 0) return new Map()
  const unique = [...new Set(agentIds)]
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, first_name, last_name")
    .in("id", unique)

  if (error || !data) return new Map()
  const map = new Map<string, string>()
  for (const row of data) {
    // Prefer the person's real name over shop/display names in support chat.
    const name = formatPersonName(
      row.first_name as string | null,
      row.last_name as string | null,
      String(row.display_name ?? "").trim(),
    )
    map.set(String(row.id), name || "Support")
  }
  return map
}
