import type { SupabaseClient } from "@supabase/supabase-js"
import {
  fetchForumThreadAuthorProfiles,
  fetchForumThreadEngagementByThreadIds,
  fetchRecentForumComments,
  fetchRecentForumThreads,
  fetchRecentForumThreadsByCreatedAt,
  fetchForumThreadsByIds,
  searchForumThreads,
  type ForumThreadRow,
} from "@/lib/db/forum-threads"
import { getBoardTalkReviewFeed } from "@/lib/services/boardTalkReviews"

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

export type BoardTalkWhatsNewItem =
  | {
      type: "thread"
      id: string
      slug: string
      title: string
      authorName: string
      createdAt: string
    }
  | {
      type: "comment"
      id: string
      threadSlug: string
      threadTitle: string
      excerpt: string
      authorName: string
      createdAt: string
    }
  | {
      type: "review"
      id: string
      brandSlug: string
      brandName: string
      modelSlug: string
      modelName: string
      rating: number
      excerpt: string
      authorName: string
      createdAt: string
    }

function commentExcerpt(body: string, maxLen = 140): string {
  const plain = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
  if (!plain) return "New comment"
  return plain.length > maxLen ? `${plain.slice(0, maxLen - 1)}…` : plain
}

export async function getBoardTalkWhatsNewFeed(
  supabase: SupabaseClient,
  limit = 30,
): Promise<BoardTalkWhatsNewItem[]> {
  const perSource = Math.max(8, Math.ceil(limit / 3))

  const [threads, comments, reviews] = await Promise.all([
    fetchRecentForumThreadsByCreatedAt(supabase, perSource),
    fetchRecentForumComments(supabase, perSource),
    getBoardTalkReviewFeed(supabase, perSource),
  ])

  const threadIds = [...new Set(comments.map((c) => c.thread_id))]
  const [threadProfiles, commentProfiles, commentThreads] = await Promise.all([
    fetchForumThreadAuthorProfiles(supabase, [...new Set(threads.map((t) => t.user_id))]),
    fetchForumThreadAuthorProfiles(supabase, [...new Set(comments.map((c) => c.user_id))]),
    fetchForumThreadsByIds(supabase, threadIds),
  ])

  const profileById = Object.fromEntries(
    [...threadProfiles, ...commentProfiles].map((p) => [p.id, p]),
  )
  const threadById = Object.fromEntries(commentThreads.map((t) => [t.id, t]))

  const items: BoardTalkWhatsNewItem[] = []

  for (const thread of threads) {
    items.push({
      type: "thread",
      id: thread.id,
      slug: thread.slug,
      title: thread.title,
      authorName: profileById[thread.user_id]?.display_name?.trim() || "Member",
      createdAt: thread.created_at,
    })
  }

  for (const comment of comments) {
    const thread = threadById[comment.thread_id]
    if (!thread) continue
    items.push({
      type: "comment",
      id: comment.id,
      threadSlug: thread.slug,
      threadTitle: thread.title,
      excerpt: commentExcerpt(comment.body),
      authorName: profileById[comment.user_id]?.display_name?.trim() || "Member",
      createdAt: comment.created_at,
    })
  }

  for (const review of reviews) {
    items.push({
      type: "review",
      id: review.id,
      brandSlug: review.brandSlug,
      brandName: review.brandName,
      modelSlug: review.modelSlug,
      modelName: review.modelName,
      rating: review.rating,
      excerpt: review.comment ? commentExcerpt(review.comment, 100) : `${review.rating}-star review`,
      authorName: review.authorName,
      createdAt: review.createdAt,
    })
  }

  return items
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit)
}
