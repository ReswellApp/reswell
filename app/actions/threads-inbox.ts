"use server"

import { createClient } from "@/lib/supabase/server"
import {
  countForumUnreadRepliesForUser,
  loadForumInboxForUser,
  markForumNotificationsReadForUser,
} from "@/lib/db/forum-notifications-inbox"
import type {
  ForumInboxPayload,
  ForumNotificationType,
} from "@/lib/types/forum-notifications-inbox"

export async function refreshThreadsInbox(): Promise<{ error: string } | ForumInboxPayload> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Unauthorized" }
  }

  return loadForumInboxForUser(user.id)
}

export async function markThreadsInboxNotificationsRead(opts?: {
  ids?: string[]
  types?: ForumNotificationType[]
}): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Unauthorized" }
  }

  await markForumNotificationsReadForUser(user.id, opts)
  return { ok: true }
}

export async function getThreadsUnreadReplyCount(userId: string): Promise<number> {
  return countForumUnreadRepliesForUser(userId)
}
