import type { SupabaseClient } from "@supabase/supabase-js"

export type ForumThreadRow = {
  id: string
  title: string
  slug: string
  body: string | null
  created_at: string
  updated_at: string
  user_id: string
}

export type ForumThreadParticipant = {
  userId: string
  displayName: string
  avatarUrl: string | null
}

export type ForumThreadAuthorProfile = {
  id: string
  display_name: string | null
  avatar_url: string | null
}

function countByKey(rows: { thread_id: string }[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const r of rows) {
    out[r.thread_id] = (out[r.thread_id] ?? 0) + 1
  }
  return out
}

/** Top-level comments only (exclude nested replies). */
function countTopLevelComments(
  rows: { thread_id: string; parent_id: string | null }[],
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const r of rows) {
    if (r.parent_id != null) continue
    out[r.thread_id] = (out[r.thread_id] ?? 0) + 1
  }
  return out
}

function escapeIlikeToken(q: string): string {
  return q.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

export async function searchForumThreads(
  supabase: SupabaseClient,
  q: string,
): Promise<ForumThreadRow[]> {
  let query = supabase
    .from("forum_threads")
    .select("id, title, slug, body, created_at, updated_at, user_id")
    .order("updated_at", { ascending: false })

  const trimmed = q.trim()
  if (trimmed) {
    const safe = escapeIlikeToken(trimmed)
    const pattern = `%${safe}%`

    const { data: authorProfiles } = await supabase
      .from("profiles")
      .select("id")
      .or(`display_name.ilike.${pattern},shop_name.ilike.${pattern}`)

    const authorIds = (authorProfiles ?? []).map((p) => p.id)
    const orParts = [`title.ilike.${pattern}`, `body.ilike.${pattern}`]
    if (authorIds.length > 0) {
      orParts.push(`user_id.in.(${authorIds.join(",")})`)
    }
    query = query.or(orParts.join(","))
  }

  const { data, error } = await query
  if (error) {
    console.error("[forum-threads] searchForumThreads:", error.message)
    return []
  }

  return (data ?? []) as ForumThreadRow[]
}

export async function fetchRecentForumThreads(
  supabase: SupabaseClient,
  limit: number,
): Promise<ForumThreadRow[]> {
  const { data, error } = await supabase
    .from("forum_threads")
    .select("id, title, slug, body, created_at, updated_at, user_id")
    .order("updated_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.error("[forum-threads] fetchRecentForumThreads:", error.message)
    return []
  }

  return (data ?? []) as ForumThreadRow[]
}

export async function fetchForumThreadAuthorProfiles(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<ForumThreadAuthorProfile[]> {
  if (userIds.length === 0) return []

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", userIds)

  if (error) {
    console.error("[forum-threads] fetchForumThreadAuthorProfiles:", error.message)
    return []
  }

  return (data ?? []) as ForumThreadAuthorProfile[]
}

export async function fetchForumThreadEngagementByThreadIds(
  supabase: SupabaseClient,
  threadIds: string[],
): Promise<{ commentCountByThread: Record<string, number>; likeCountByThread: Record<string, number> }> {
  if (threadIds.length === 0) {
    return { commentCountByThread: {}, likeCountByThread: {} }
  }

  const [{ data: commentRows }, { data: likeRows }] = await Promise.all([
    supabase.from("forum_comments").select("thread_id, parent_id").in("thread_id", threadIds),
    supabase.from("forum_thread_likes").select("thread_id").in("thread_id", threadIds),
  ])

  return {
    commentCountByThread: countTopLevelComments(
      (commentRows ?? []) as { thread_id: string; parent_id: string | null }[],
    ),
    likeCountByThread: countByKey((likeRows ?? []) as { thread_id: string }[]),
  }
}

const MAX_PARTICIPANTS_PER_THREAD = 5

export async function fetchForumThreadParticipantsByThreadIds(
  supabase: SupabaseClient,
  threads: Pick<ForumThreadRow, "id" | "user_id">[],
): Promise<Record<string, ForumThreadParticipant[]>> {
  if (threads.length === 0) return {}

  const threadIds = threads.map((t) => t.id)
  const authorByThread = Object.fromEntries(threads.map((t) => [t.id, t.user_id]))

  const { data: commentRows, error } = await supabase
    .from("forum_comments")
    .select("thread_id, user_id")
    .in("thread_id", threadIds)

  if (error) {
    console.error("[forum-threads] fetchForumThreadParticipantsByThreadIds:", error.message)
    return {}
  }

  const userIdsByThread = new Map<string, string[]>()
  for (const threadId of threadIds) {
    const authorId = authorByThread[threadId]
    const commentUserIds = (commentRows ?? [])
      .filter((r) => r.thread_id === threadId)
      .map((r) => r.user_id as string)
    const seen = new Set<string>()
    const ordered: string[] = []
    for (const uid of [authorId, ...commentUserIds]) {
      if (!uid || seen.has(uid)) continue
      seen.add(uid)
      ordered.push(uid)
      if (ordered.length >= MAX_PARTICIPANTS_PER_THREAD) break
    }
    userIdsByThread.set(threadId, ordered)
  }

  const allUserIds = [...new Set([...userIdsByThread.values()].flat())]
  if (allUserIds.length === 0) return {}

  const profiles = await fetchForumThreadAuthorProfiles(supabase, allUserIds)
  const profileById = Object.fromEntries(profiles.map((p) => [p.id, p]))

  const out: Record<string, ForumThreadParticipant[]> = {}
  for (const [threadId, userIds] of userIdsByThread) {
    out[threadId] = userIds.map((userId) => {
      const profile = profileById[userId]
      return {
        userId,
        displayName: profile?.display_name?.trim() || "Member",
        avatarUrl: profile?.avatar_url ?? null,
      }
    })
  }
  return out
}

/** Preserve Elasticsearch result order. */
export async function fetchForumThreadsByIds(
  supabase: SupabaseClient,
  ids: string[],
): Promise<ForumThreadRow[]> {
  if (ids.length === 0) return []

  const { data, error } = await supabase
    .from("forum_threads")
    .select("id, title, slug, body, created_at, updated_at, user_id")
    .in("id", ids)

  if (error) {
    console.error("[forum-threads] fetchForumThreadsByIds:", error.message)
    return []
  }

  const byId = Object.fromEntries(((data ?? []) as ForumThreadRow[]).map((t) => [t.id, t]))
  return ids.map((id) => byId[id]).filter((t): t is ForumThreadRow => Boolean(t))
}
