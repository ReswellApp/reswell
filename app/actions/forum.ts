"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import {
  deleteForumCommentWithAuth,
  deleteForumThreadAsModerator,
} from "@/lib/services/forumModeration"
import { sendForumCommentMediaMessage } from "@/lib/services/sendForumCommentMedia"
import { forumCommentAttachmentInputSchema, type SentForumCommentMedia } from "@/lib/validations/forum-comment-attachment"
import {
  deleteForumThreadDocument,
  syncForumThreadToIndex,
} from "@/lib/elasticsearch/forum-threads-index"

const idSchema = z.string().uuid()

const sendForumCommentMediaSchema = z.object({
  thread_id: idSchema,
  thread_slug: z.string().min(1).max(200),
  attachment: forumCommentAttachmentInputSchema,
  caption: z.string().max(8000).optional(),
  parent_id: idSchema.nullable().optional(),
})

export async function sendForumCommentMediaReply(input: {
  thread_id: string
  thread_slug: string
  attachment: z.infer<typeof forumCommentAttachmentInputSchema>
  caption?: string
  parent_id?: string | null
}): Promise<{ comment: SentForumCommentMedia } | { error: string }> {
  const parsed = sendForumCommentMediaSchema.safeParse(input)
  if (!parsed.success) {
    return { error: "Invalid photo comment." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Sign in to post photos." }
  }

  const result = await sendForumCommentMediaMessage({
    threadId: parsed.data.thread_id,
    senderId: user.id,
    attachment: parsed.data.attachment,
    caption: parsed.data.caption,
    parentId: parsed.data.parent_id ?? null,
  })

  if (!result.ok) {
    return { error: result.error }
  }

  try {
    const service = createServiceRoleClient()
    await syncForumThreadToIndex(service, parsed.data.thread_id)
  } catch (err) {
    console.error("[forum] sync thread index after media comment:", err)
  }

  revalidatePath("/threads")
  revalidatePath(`/threads/${parsed.data.thread_slug}`)

  return { comment: result.comment as SentForumCommentMedia }
}

export async function deleteForumThreadAction(
  threadIdRaw: string,
): Promise<{ success: true } | { error: string }> {
  const parsed = idSchema.safeParse(threadIdRaw)
  if (!parsed.success) {
    return { error: "Invalid post." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Sign in to manage posts." }
  }

  const result = await deleteForumThreadAsModerator(supabase, user.id, parsed.data)
  if (!result.ok) {
    return { error: result.error }
  }

  try {
    await deleteForumThreadDocument(parsed.data)
  } catch (err) {
    console.error("[forum] delete thread from index:", err)
  }

  revalidatePath("/threads")
  return { success: true }
}

export async function deleteForumCommentAction(
  commentIdRaw: string,
  threadSlugRaw: string,
): Promise<{ success: true } | { error: string }> {
  const commentParsed = idSchema.safeParse(commentIdRaw)
  const slug = threadSlugRaw.trim()
  if (!commentParsed.success || !slug) {
    return { error: "Invalid comment." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Sign in to manage comments." }
  }

  const result = await deleteForumCommentWithAuth(supabase, user.id, commentParsed.data)
  if (!result.ok) {
    return { error: result.error }
  }

  try {
    const service = createServiceRoleClient()
    const { data: thread } = await service
      .from("forum_threads")
      .select("id")
      .eq("slug", slug)
      .maybeSingle()
    if (thread?.id) await syncForumThreadToIndex(service, thread.id)
  } catch (err) {
    console.error("[forum] sync thread index after comment delete:", err)
  }

  revalidatePath("/threads")
  revalidatePath(`/threads/${slug}`)
  return { success: true }
}
