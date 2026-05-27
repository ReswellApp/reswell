import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  forumCommentAttachmentMetadataSchema,
  type ForumCommentAttachment,
} from "@/lib/validations/forum-comment-attachment"

export type ForumCommentAttachmentDownloadAuthResult =
  | {
      ok: true
      bucket: string
      path: string
      fileName: string
      mimeType: string
      attachmentKind: ForumCommentAttachment["kind"]
    }
  | { ok: false; error: string; status: number }

/** Public Board Talk comments — anyone may load attachment bytes via the app proxy. */
export async function authorizeForumCommentAttachmentDownload(
  commentId: string,
): Promise<ForumCommentAttachmentDownloadAuthResult> {
  const sr = createServiceRoleClient()
  const { data: comment, error: commentErr } = await sr
    .from("forum_comments")
    .select("id, metadata")
    .eq("id", commentId)
    .maybeSingle()

  if (commentErr || !comment) {
    return { ok: false, error: "Comment not found", status: 404 }
  }

  const meta = forumCommentAttachmentMetadataSchema.safeParse(comment.metadata)
  if (!meta.success) {
    return { ok: false, error: "Not an attachment", status: 400 }
  }

  const { bucket, path, file_name: fileName, mime_type: mimeType, kind } = meta.data.attachment

  return { ok: true, bucket, path, fileName, mimeType, attachmentKind: kind }
}
