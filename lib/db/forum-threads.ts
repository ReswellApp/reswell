import type { SupabaseClient } from "@supabase/supabase-js"

export type ForumThreadRow = {
  id: string
  title: string
  slug: string
  created_at: string
  updated_at: string
  user_id: string
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
    .select("id, title, slug, created_at, updated_at, user_id")
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

export type ForumCommentActivityRow = {
  id: string
  body: string
  created_at: string
  user_id: string
  thread_id: string
}

export type ForumCommentThreadMeta = {
  id: string
  title: string
  slug: string
}

export async function fetchRecentForumComments(
  supabase: SupabaseClient,
  limit: number,
): Promise<ForumCommentActivityRow[]> {
  const { data, error } = await supabase
    .from("forum_comments")
    .select("id, body, created_at, user_id, thread_id")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.error("[forum-threads] fetchRecentForumComments:", error.message)
    return []
  }

  return (data ?? []) as ForumCommentActivityRow[]
}

export async function fetchForumThreadsByIds(
  supabase: SupabaseClient,
  threadIds: string[],
): Promise<ForumCommentThreadMeta[]> {
  if (threadIds.length === 0) return []

  const { data, error } = await supabase
    .from("forum_threads")
    .select("id, title, slug")
    .in("id", threadIds)

  if (error) {
    console.error("[forum-threads] fetchForumThreadsByIds:", error.message)
    return []
  }

  return (data ?? []) as ForumCommentThreadMeta[]
}

export async function fetchRecentForumThreadsByCreatedAt(
  supabase: SupabaseClient,
  limit: number,
): Promise<ForumThreadRow[]> {
  const { data, error } = await supabase
    .from("forum_threads")
    .select("id, title, slug, created_at, updated_at, user_id")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.error("[forum-threads] fetchRecentForumThreadsByCreatedAt:", error.message)
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
    .select("id, title, slug, created_at, updated_at, user_id")
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
