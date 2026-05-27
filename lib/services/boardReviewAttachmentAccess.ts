import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  boardReviewAttachmentMetadataSchema,
  type BoardReviewAttachment,
} from "@/lib/validations/board-review-attachment"

export type BoardReviewAttachmentDownloadAuthResult =
  | {
      ok: true
      bucket: string
      path: string
      fileName: string
      mimeType: string
      attachmentKind: BoardReviewAttachment["kind"]
    }
  | { ok: false; error: string; status: number }

/** Public board reviews — anyone may load attachment bytes via the app proxy. */
export async function authorizeBoardReviewAttachmentDownload(
  reviewId: string,
): Promise<BoardReviewAttachmentDownloadAuthResult> {
  const sr = createServiceRoleClient()
  const { data: review, error: reviewErr } = await sr
    .from("board_model_reviews")
    .select("id, metadata")
    .eq("id", reviewId)
    .maybeSingle()

  if (reviewErr || !review) {
    return { ok: false, error: "Review not found", status: 404 }
  }

  const meta = boardReviewAttachmentMetadataSchema.safeParse(review.metadata)
  if (!meta.success) {
    return { ok: false, error: "Not an attachment", status: 400 }
  }

  const { bucket, path, file_name: fileName, mime_type: mimeType, kind } = meta.data.attachment

  return { ok: true, bucket, path, fileName, mimeType, attachmentKind: kind }
}
