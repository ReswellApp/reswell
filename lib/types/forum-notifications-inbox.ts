export type ForumNotificationType =
  | "thread_reply"
  | "comment_reply"
  | "thread_like"
  | "comment_like"

export type ForumInboxNotification = {
  id: string
  type: ForumNotificationType
  actor_id: string | null
  thread_id: string
  comment_id: string | null
  message: string | null
  is_read: boolean
  created_at: string
  thread: {
    id: string
    title: string
    slug: string
  } | null
  actor: {
    id: string
    display_name: string | null
    avatar_url: string | null
  } | null
}

export type ForumInboxPayload = {
  notifications: ForumInboxNotification[]
  unreadReplies: number
  unreadActivity: number
}

export const FORUM_REPLY_TYPES: ForumNotificationType[] = ["thread_reply", "comment_reply"]
export const FORUM_ACTIVITY_TYPES: ForumNotificationType[] = ["thread_like", "comment_like"]
