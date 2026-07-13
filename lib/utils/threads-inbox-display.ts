import {
  FORUM_ACTIVITY_TYPES,
  FORUM_REPLY_TYPES,
  type ForumInboxNotification,
} from "@/lib/types/forum-notifications-inbox"

export type ThreadsMessageGroup = {
  threadId: string
  threadTitle: string
  threadSlug: string
  totalUnread: number
  latestNotification: ForumInboxNotification
}


export function isForumReplyNotification(type: string): boolean {
  return FORUM_REPLY_TYPES.includes(type as (typeof FORUM_REPLY_TYPES)[number])
}

export function isForumActivityNotification(type: string): boolean {
  return FORUM_ACTIVITY_TYPES.includes(type as (typeof FORUM_ACTIVITY_TYPES)[number])
}

export function filterForumReplyNotifications(
  notifications: ForumInboxNotification[],
): ForumInboxNotification[] {
  return notifications.filter((n) => isForumReplyNotification(n.type))
}

export function filterForumActivityNotifications(
  notifications: ForumInboxNotification[],
): ForumInboxNotification[] {
  return notifications.filter((n) => isForumActivityNotification(n.type))
}

export function forumNotificationHref(notification: ForumInboxNotification): string {
  const slug = notification.thread?.slug
  if (!slug) return "/threads"
  if (notification.comment_id) {
    return `/threads/${slug}#comment-${notification.comment_id}`
  }
  return `/threads/${slug}`
}

export function forumActivityKindLabel(type: string): string {
  switch (type) {
    case "thread_like":
      return "Stoke"
    case "comment_like":
      return "Stoke"
    case "thread_reply":
      return "Reply"
    case "comment_reply":
      return "Reply"
    default:
      return "Activity"
  }
}

export function groupForumReplyNotifications(
  notifications: ForumInboxNotification[],
  limit = 8,
): ThreadsMessageGroup[] {
  const byThread = new Map<string, ThreadsMessageGroup>()

  for (const notification of notifications) {
    const thread = notification.thread
    if (!thread?.slug) continue

    const existing = byThread.get(notification.thread_id)
    const unreadDelta = notification.is_read ? 0 : 1

    if (!existing) {
      byThread.set(notification.thread_id, {
        threadId: notification.thread_id,
        threadTitle: thread.title,
        threadSlug: thread.slug,
        totalUnread: unreadDelta,
        latestNotification: notification,
      })
      continue
    }

    existing.totalUnread += unreadDelta
    if (
      new Date(notification.created_at).getTime() >
      new Date(existing.latestNotification.created_at).getTime()
    ) {
      existing.latestNotification = notification
    }
  }

  return [...byThread.values()]
    .sort(
      (a, b) =>
        new Date(b.latestNotification.created_at).getTime() -
        new Date(a.latestNotification.created_at).getTime(),
    )
    .slice(0, limit)
}

export function actorDisplayName(notification: ForumInboxNotification): string {
  return notification.actor?.display_name?.trim() || "Someone"
}
