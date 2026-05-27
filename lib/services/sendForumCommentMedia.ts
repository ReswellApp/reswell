import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  FORUM_ATTACHMENTS_BUCKET,
  composeForumCommentImageBody,
  forumCommentAttachmentMetadataSchema,
  forumCommentAttachmentSchema,
  type ForumCommentAttachment,
} from "@/lib/validations/forum-comment-attachment"

export type SendForumCommentMediaResult =
  | {
      ok: true
      comment: {
        id: string
        body: string
        created_at: string
        user_id: string
        parent_id: string | null
        metadata: { attachment: ForumCommentAttachment }
      }
    }
  | { ok: false; error: string; status?: number }

function attachmentPathBelongsToThread(path: string, threadId: string): boolean {
  const prefix = `${threadId}/`
  return path.startsWith(prefix) && path.length > prefix.length
}

export async function sendForumCommentMediaMessage(input: {
  threadId: string
  senderId: string
  attachment: Omit<ForumCommentAttachment, "bucket">
  caption?: string | null
  parentId?: string | null
}): Promise<SendForumCommentMediaResult> {
  const { threadId, senderId, caption, parentId = null } = input

  const attachmentParsed = forumCommentAttachmentSchema.safeParse({
    ...input.attachment,
    bucket: FORUM_ATTACHMENTS_BUCKET,
  })
  if (!attachmentParsed.success) {
    return { ok: false, error: "Invalid attachment", status: 400 }
  }

  const attachment = attachmentParsed.data
  if (!attachmentPathBelongsToThread(attachment.path, threadId)) {
    return { ok: false, error: "Invalid attachment path", status: 400 }
  }

  const service = createServiceRoleClient()

  const { data: thread, error: threadErr } = await service
    .from("forum_threads")
    .select("id")
    .eq("id", threadId)
    .maybeSingle()

  if (threadErr || !thread) {
    return { ok: false, error: "Thread not found", status: 404 }
  }

  if (parentId) {
    const { data: parentComment, error: parentErr } = await service
      .from("forum_comments")
      .select("id, thread_id, parent_id")
      .eq("id", parentId)
      .maybeSingle()

    if (parentErr || !parentComment || parentComment.thread_id !== threadId) {
      return { ok: false, error: "Reply target not found", status: 404 }
    }
    if (parentComment.parent_id != null) {
      return { ok: false, error: "You can only reply to a top-level comment", status: 400 }
    }
  }

  const objectName = attachment.path.slice(threadId.length + 1)
  const { data: listed, error: listErr } = await service.storage
    .from(FORUM_ATTACHMENTS_BUCKET)
    .list(threadId, { search: objectName, limit: 1 })

  if (listErr || !listed?.some((item) => item.name === objectName)) {
    return { ok: false, error: "Attachment not found in storage", status: 400 }
  }

  const defaultBody = composeForumCommentImageBody()
  const trimmedCaption = caption?.trim() ?? ""
  const content = (trimmedCaption || defaultBody).slice(0, 8000)

  const metadata = { attachment }
  const parsedMeta = forumCommentAttachmentMetadataSchema.safeParse(metadata)
  if (!parsedMeta.success) {
    return { ok: false, error: "Invalid metadata", status: 500 }
  }

  const { data: inserted, error: insErr } = await service
    .from("forum_comments")
    .insert({
      thread_id: threadId,
      user_id: senderId,
      body: content,
      parent_id: parentId,
      metadata: parsedMeta.data,
    })
    .select("id, body, created_at, user_id, parent_id, metadata")
    .single()

  if (insErr || !inserted) {
    console.error("[sendForumCommentMediaMessage] insert:", insErr)
    return { ok: false, error: "Could not post comment", status: 500 }
  }

  const metaRow = inserted.metadata as unknown
  const att = forumCommentAttachmentMetadataSchema.safeParse(metaRow)
  if (!att.success) {
    return { ok: false, error: "Comment created with invalid shape", status: 500 }
  }

  return {
    ok: true,
    comment: {
      id: inserted.id as string,
      body: inserted.body as string,
      created_at: inserted.created_at as string,
      user_id: inserted.user_id as string,
      parent_id: (inserted.parent_id as string | null) ?? null,
      metadata: att.data,
    },
  }
}
