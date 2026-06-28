import type { SupabaseClient } from "@supabase/supabase-js"
import { isElasticsearchConfigured } from "@/lib/elasticsearch/config"
import { searchForumThreadIdsFromElasticsearch } from "@/lib/elasticsearch/forum-threads-index"
import {
  fetchForumThreadAuthorProfiles,
  fetchForumThreadEngagementByThreadIds,
  fetchForumThreadParticipantsByThreadIds,
  fetchForumThreadsByIds,
  fetchRecentForumThreads,
  searchForumThreads,
  type ForumThreadParticipant,
  type ForumThreadRow,
} from "@/lib/db/forum-threads"

export type { ForumThreadParticipant }

export type BoardTalkThreadPreview = {
  id: string
  title: string
  slug: string
  updatedAt: string
  authorName: string
  authorAvatarUrl: string | null
  commentCount: number
  likeCount: number
  bodyExcerpt: string | null
  participants: ForumThreadParticipant[]
}

export type BoardTalkForumThread = BoardTalkThreadPreview & {
  createdAt: string
}

function bodyExcerpt(body: string | null | undefined): string | null {
  if (!body?.trim()) return null
  const plain = body.replace(/\s+/g, " ").trim()
  if (!plain) return null
  return plain.length > 140 ? `${plain.slice(0, 137)}…` : plain
}

async function enrichForumThreads(
  supabase: SupabaseClient,
  threads: ForumThreadRow[],
): Promise<BoardTalkForumThread[]> {
  if (threads.length === 0) return []

  const ids = threads.map((t) => t.id)
  const userIds = [...new Set(threads.map((t) => t.user_id))]

  const [profiles, engagement, participantsByThread] = await Promise.all([
    fetchForumThreadAuthorProfiles(supabase, userIds),
    fetchForumThreadEngagementByThreadIds(supabase, ids),
    fetchForumThreadParticipantsByThreadIds(supabase, threads),
  ])

  const profileById = Object.fromEntries(profiles.map((p) => [p.id, p]))

  return threads.map((t) => ({
    id: t.id,
    title: t.title,
    slug: t.slug,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
    authorName: profileById[t.user_id]?.display_name?.trim() || "Member",
    authorAvatarUrl: profileById[t.user_id]?.avatar_url ?? null,
    bodyExcerpt: bodyExcerpt(t.body),
    commentCount: engagement.commentCountByThread[t.id] ?? 0,
    likeCount: engagement.likeCountByThread[t.id] ?? 0,
    participants: participantsByThread[t.id] ?? [],
  }))
}

export async function getBoardTalkForumThreads(
  supabase: SupabaseClient,
  q = "",
): Promise<BoardTalkForumThread[]> {
  const trimmed = q.trim()

  if (trimmed && isElasticsearchConfigured()) {
    try {
      const ids = await searchForumThreadIdsFromElasticsearch(trimmed, 100)
      if (ids.length === 0) return []
      const threads = await fetchForumThreadsByIds(supabase, ids)
      return enrichForumThreads(supabase, threads)
    } catch (err) {
      console.error("[forumThreads] Elasticsearch search failed, using Supabase:", err)
    }
  }

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
