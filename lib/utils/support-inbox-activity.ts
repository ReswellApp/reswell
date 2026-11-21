import type { MessagesInboxNotification } from "../db/messagesInbox"

export const SUPPORT_REPLY_ACTIVITY_TYPE = "support_reply"

/** Newest-first public agent rows fetched per Activity page (not a global 4×case cap). */
export const SUPPORT_INBOX_ACTIVITY_AGENT_BATCH_LIMIT = 400

export type SupportActivityAgentMessage = {
  case_id: unknown
  created_at: unknown
  author_role?: unknown
  is_internal?: unknown
}

/**
 * After one newest-first agent-message page, which loaded cases still need a fetch?
 * A short page means remaining cases have no public agent rows. A full page of one
 * busy ticket must not drop siblings from Activity.
 */
export function remainingSupportActivityCaseIds(args: {
  caseIds: readonly string[]
  page: ReadonlyArray<SupportActivityAgentMessage>
  batchLimit?: number
}): string[] {
  const batchLimit = args.batchLimit ?? SUPPORT_INBOX_ACTIVITY_AGENT_BATCH_LIMIT
  if (args.page.length < batchLimit) return []
  const covered = new Set(args.page.map((row) => String(row.case_id)))
  return args.caseIds.filter((id) => !covered.has(id))
}

/** First row wins; callers must pass newest-first pages. */
export function latestAgentCreatedAtByCaseId(
  messages: ReadonlyArray<SupportActivityAgentMessage>,
): Map<string, string> {
  const latestByCase = new Map<string, string>()
  for (const message of messages) {
    const caseId = String(message.case_id)
    if (latestByCase.has(caseId)) continue
    latestByCase.set(caseId, String(message.created_at))
  }
  return latestByCase
}

export function isSupportActivityType(type: string | undefined): boolean {
  return (type || "").toLowerCase() === SUPPORT_REPLY_ACTIVITY_TYPE
}

function titleFromSubject(subject: string): string {
  return subject.trim().replace(/^\[(Seller|Buyer)\]\s*/i, "").trim()
}

export function supportCaseToInboxNotification(item: {
  id: string
  subject: string
  unreadCount: number
  latestAgentAt: string
}): MessagesInboxNotification {
  return {
    id: `support:${item.id}`,
    type: SUPPORT_REPLY_ACTIVITY_TYPE,
    listing_id: null,
    actor_id: null,
    message: "Reswell replied to your request",
    is_read: item.unreadCount <= 0,
    created_at: item.latestAgentAt,
    listings: null,
    support_case_id: item.id,
    support_subject: titleFromSubject(item.subject),
  }
}

export function mergeInboxActivityNotifications(
  notifications: MessagesInboxNotification[],
  supportItems: MessagesInboxNotification[],
): MessagesInboxNotification[] {
  const seen = new Set(
    notifications
      .filter((n) => isSupportActivityType(n.type))
      .map((n) => n.support_case_id ?? n.id),
  )
  const extra = supportItems.filter((item) => !seen.has(item.support_case_id ?? item.id))
  return [...notifications, ...extra].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )
}
