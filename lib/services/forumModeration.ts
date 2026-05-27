import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  deleteForumCommentById,
  deleteForumThreadById,
  fetchForumCommentAuthorId,
  fetchForumCommentMetadata,
  profileIsForumAdmin,
  removeForumCommentAttachment,
} from "@/lib/db/forum-mutations"
import { parseForumCommentImageAttachment } from "@/lib/validations/forum-comment-attachment"

export async function deleteForumThreadAsModerator(
  supabase: SupabaseClient,
  userId: string,
  threadId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const isAdmin = await profileIsForumAdmin(supabase, userId)
  if (!isAdmin) {
    return { ok: false, error: "Only admins can delete posts." }
  }
  return deleteForumThreadById(supabase, threadId)
}

export async function deleteForumCommentWithAuth(
  supabase: SupabaseClient,
  userId: string,
  commentId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const authorId = await fetchForumCommentAuthorId(supabase, commentId)
  if (!authorId) {
    return { ok: false, error: "Comment not found." }
  }

  const isAdmin = await profileIsForumAdmin(supabase, userId)
  if (authorId !== userId && !isAdmin) {
    return { ok: false, error: "You can only delete your own comments." }
  }

  const metadata = await fetchForumCommentMetadata(supabase, commentId)
  const attachment = parseForumCommentImageAttachment(metadata)
  const deleted = await deleteForumCommentById(supabase, commentId)
  if (!deleted.ok) {
    return deleted
  }

  if (attachment) {
    const storageClient = createServiceRoleClient()
    await removeForumCommentAttachment(storageClient, attachment.bucket, attachment.path)
  }

  return { ok: true }
}
