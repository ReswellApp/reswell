/**
 * When a visitor comes back, resume only an unresolved thread that is still
 * warm. Resolved, closed, or stale chats mint a fresh session.
 */

export const LIVE_CHAT_SESSION_STALE_MS = 24 * 60 * 60 * 1000

export type LiveChatSessionResumeStatus = "open" | "assigned" | "resolved" | "closed" | string

export type LiveChatSessionResumeInput = {
  status: LiveChatSessionResumeStatus
  lastActivityAt: string | null | undefined
  nowMs?: number
}

export function liveChatSessionActivityAt(session: {
  last_message_at?: string | null
  last_visitor_message_at?: string | null
  last_agent_message_at?: string | null
  updated_at?: string | null
  created_at?: string | null
}): string | null {
  const candidates = [
    session.last_message_at,
    session.last_visitor_message_at,
    session.last_agent_message_at,
    session.updated_at,
    session.created_at,
  ].filter((value): value is string => Boolean(value?.trim()))
  if (candidates.length === 0) return null
  return candidates.reduce((latest, current) =>
    Date.parse(current) > Date.parse(latest) ? current : latest,
  )
}

export function isLiveChatSessionStale(args: {
  lastActivityAt: string | null | undefined
  nowMs?: number
  staleMs?: number
}): boolean {
  const at = args.lastActivityAt ? Date.parse(args.lastActivityAt) : Number.NaN
  if (!Number.isFinite(at)) return true
  const now = args.nowMs ?? Date.now()
  return now - at >= (args.staleMs ?? LIVE_CHAT_SESSION_STALE_MS)
}

/** Unresolved + recent stays. Resolved, closed, or stale (≥ 24h) start fresh. */
export function shouldResumeLiveChatSession(args: LiveChatSessionResumeInput): boolean {
  if (args.status === "resolved" || args.status === "closed") return false
  if (args.status !== "open" && args.status !== "assigned") return false
  return !isLiveChatSessionStale({
    lastActivityAt: args.lastActivityAt,
    nowMs: args.nowMs,
  })
}
