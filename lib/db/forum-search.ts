import type { SupabaseClient } from "@supabase/supabase-js"

export type ForumThreadSuggestRow = {
  id: string
  title: string
  slug: string
}

export type ForumCommentSuggestRow = {
  id: string
  body: string
  excerpt: string
  thread_id: string
  thread_title: string
  thread_slug: string
}

function escapeIlikeToken(q: string): string {
  return q.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

function commentExcerpt(body: string, maxLen = 120): string {
  const plain = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
  if (!plain) return "Comment"
  return plain.length > maxLen ? `${plain.slice(0, maxLen - 1)}…` : plain
}

export async function searchForumThreadsForSuggest(
  supabase: SupabaseClient,
  q: string,
  limit: number,
): Promise<ForumThreadSuggestRow[]> {
  const safe = escapeIlikeToken(q)
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

  const { data, error } = await supabase
    .from("forum_threads")
    .select("id, title, slug")
    .or(orParts.join(","))
    .order("updated_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.error("[forum-search] thread suggest:", error)
    return []
  }

  return (data ?? []) as ForumThreadSuggestRow[]
}

export async function searchForumCommentsForSuggest(
  supabase: SupabaseClient,
  q: string,
  limit: number,
): Promise<ForumCommentSuggestRow[]> {
  const safe = escapeIlikeToken(q)
  const pattern = `%${safe}%`

  const { data: comments, error } = await supabase
    .from("forum_comments")
    .select("id, body, thread_id")
    .ilike("body", pattern)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.error("[forum-search] comment suggest:", error)
    return []
  }

  if (!comments?.length) return []

  const threadIds = [...new Set(comments.map((c) => c.thread_id))]
  const { data: threads, error: threadsError } = await supabase
    .from("forum_threads")
    .select("id, title, slug")
    .in("id", threadIds)

  if (threadsError) {
    console.error("[forum-search] comment thread hydrate:", threadsError)
    return []
  }

  const threadById = Object.fromEntries((threads ?? []).map((t) => [t.id, t]))

  const out: ForumCommentSuggestRow[] = []
  for (const comment of comments) {
    const thread = threadById[comment.thread_id]
    if (!thread) continue
    out.push({
      id: comment.id,
      body: comment.body,
      excerpt: commentExcerpt(comment.body),
      thread_id: comment.thread_id,
      thread_title: thread.title,
      thread_slug: thread.slug,
    })
  }
  return out
}
