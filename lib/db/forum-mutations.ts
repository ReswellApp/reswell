import type { SupabaseClient } from "@supabase/supabase-js"

export async function deleteForumThreadById(
  supabase: SupabaseClient,
  threadId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error, count } = await supabase
    .from("forum_threads")
    .delete({ count: "exact" })
    .eq("id", threadId)

  if (error) {
    console.error("[forum-mutations] deleteForumThreadById:", error.message)
    return { ok: false, error: "Could not delete this post." }
  }
  if (!count) {
    return { ok: false, error: "Post not found or already removed." }
  }
  return { ok: true }
}

export async function deleteForumCommentById(
  supabase: SupabaseClient,
  commentId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error, count } = await supabase
    .from("forum_comments")
    .delete({ count: "exact" })
    .eq("id", commentId)

  if (error) {
    console.error("[forum-mutations] deleteForumCommentById:", error.message)
    return { ok: false, error: "Could not delete this comment." }
  }
  if (!count) {
    return { ok: false, error: "Comment not found or already removed." }
  }
  return { ok: true }
}

export async function fetchForumCommentAuthorId(
  supabase: SupabaseClient,
  commentId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("forum_comments")
    .select("user_id")
    .eq("id", commentId)
    .maybeSingle()

  if (error) {
    console.error("[forum-mutations] fetchForumCommentAuthorId:", error.message)
    return null
  }
  return data?.user_id ?? null
}

export async function fetchForumCommentMetadata(
  supabase: SupabaseClient,
  commentId: string,
): Promise<unknown | null> {
  const { data, error } = await supabase
    .from("forum_comments")
    .select("metadata")
    .eq("id", commentId)
    .maybeSingle()

  if (error) {
    console.error("[forum-mutations] fetchForumCommentMetadata:", error.message)
    return null
  }
  return data?.metadata ?? null
}

export async function removeForumCommentAttachment(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove([path])
  if (error) {
    console.error("[forum-mutations] removeForumCommentAttachment:", error.message)
  }
}

export async function profileIsForumAdmin(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle()

  if (error) {
    console.error("[forum-mutations] profileIsForumAdmin:", error.message)
    return false
  }
  return data?.is_admin === true
}
