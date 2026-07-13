import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  FORUM_ACTIVITY_TYPES,
  FORUM_REPLY_TYPES,
  type ForumInboxNotification,
  type ForumInboxPayload,
  type ForumNotificationType,
} from "@/lib/types/forum-notifications-inbox"

export type {
  ForumInboxNotification,
  ForumInboxPayload,
  ForumNotificationType,
} from "@/lib/types/forum-notifications-inbox"

const NOTIFICATIONS_SELECT = `
  id,
  type,
  actor_id,
  thread_id,
  comment_id,
  message,
  is_read,
  created_at,
  thread:forum_threads(id, title, slug),
  actor:profiles!forum_notifications_actor_id_fkey(id, display_name, avatar_url)
`

export async function loadForumInboxForUser(userId: string): Promise<ForumInboxPayload> {
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from("forum_notifications")
    .select(NOTIFICATIONS_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) {
    console.error("[loadForumInboxForUser]", error.message)
  }

  const notifications = (data ?? []) as unknown as ForumInboxNotification[]

  const [{ count: unreadReplies }, { count: unreadActivity }] = await Promise.all([
    supabase
      .from("forum_notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false)
      .in("type", FORUM_REPLY_TYPES),
    supabase
      .from("forum_notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false)
      .in("type", FORUM_ACTIVITY_TYPES),
  ])

  return {
    notifications,
    unreadReplies: unreadReplies ?? 0,
    unreadActivity: unreadActivity ?? 0,
  }
}

export async function countForumUnreadRepliesForUser(userId: string): Promise<number> {
  const supabase = createServiceRoleClient()
  const { count, error } = await supabase
    .from("forum_notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false)
    .in("type", FORUM_REPLY_TYPES)

  if (error) {
    console.error("[countForumUnreadRepliesForUser]", error.message)
    return 0
  }

  return count ?? 0
}

export async function markForumNotificationsReadForUser(
  userId: string,
  opts?: { ids?: string[]; types?: ForumNotificationType[] },
): Promise<void> {
  const supabase = createServiceRoleClient()
  let query = supabase
    .from("forum_notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false)

  if (opts?.ids?.length) {
    query = query.in("id", opts.ids)
  }

  if (opts?.types?.length) {
    query = query.in("type", opts.types)
  }

  const { error } = await query
  if (error) {
    console.error("[markForumNotificationsReadForUser]", error.message)
  }
}
