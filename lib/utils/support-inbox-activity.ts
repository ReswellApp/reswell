import type { MessagesInboxNotification } from "../db/messagesInbox"

export const SUPPORT_REPLY_ACTIVITY_TYPE = "support_reply"

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
