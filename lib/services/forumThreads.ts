import type { SupabaseClient } from "@supabase/supabase-js"
import {
  fetchForumThreadAuthorProfiles,
  fetchForumThreadEngagementByThreadIds,
  fetchRecentForumThreads,
  searchForumThreads,
  type ForumThreadRow,
} from "@/lib/db/forum-threads"

export type BoardTalkThreadPreview = {
  id: string
  title: string
  slug: string
  updatedAt: string
  authorName: string
  commentCount: number
  likeCount: number
}

export type BoardTalkForumThread = BoardTalkThreadPreview & {
  createdAt: string
}

async function enrichForumThreads(
  supabase: SupabaseClient,
  threads: ForumThreadRow[],
): Promise<BoardTalkForumThread[]> {
  if (threads.length === 0) return []

  const ids = threads.map((t) => t.id)
  const userIds = [...new Set(threads.map((t) => t.user_id))]

  const [profiles, engagement] = await Promise.all([
    fetchForumThreadAuthorProfiles(supabase, userIds),
    fetchForumThreadEngagementByThreadIds(supabase, ids),
  ])

  const profileById = Object.fromEntries(profiles.map((p) => [p.id, p]))

  return threads.map((t) => ({
    id: t.id,
    title: t.title,
    slug: t.slug,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
    authorName: profileById[t.user_id]?.display_name?.trim() || "Member",
    commentCount: engagement.commentCountByThread[t.id] ?? 0,
    likeCount: engagement.likeCountByThread[t.id] ?? 0,
  }))
}

export async function getBoardTalkForumThreads(
  supabase: SupabaseClient,
  q = "",
): Promise<BoardTalkForumThread[]> {
  const threads = await searchForumThreads(supabase, q)
  return enrichForumThreads(supabase, threads)
}

export async function getBoardTalkThreadPreviews(
  supabase: SupabaseClient,
  limit = 5,
): Promise<BoardTalkThreadPreview[]> {
  const threads = await fetchRecentForumThreads(supabase, limit)
  const enriched = await enrichForumThreads(supabase, threads)
  return enriched.map(({ createdAt: _createdAt, ...rest }) => rest)
}
