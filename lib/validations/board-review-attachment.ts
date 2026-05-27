import { z } from "zod"

export const BOARD_REVIEW_ATTACHMENTS_BUCKET = "board-review-attachments"

export const boardReviewImageAttachmentSchema = z.object({
  kind: z.literal("image"),
  bucket: z.string().min(1),
  path: z.string().min(1),
  file_name: z.string().min(1).max(500),
  mime_type: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
  size_bytes: z.number().int().positive(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
})

export const boardReviewAttachmentSchema = boardReviewImageAttachmentSchema

export const boardReviewAttachmentMetadataSchema = z.object({
  attachment: boardReviewAttachmentSchema,
})

export const boardReviewAttachmentInputSchema = boardReviewImageAttachmentSchema.omit({ bucket: true })

export type BoardReviewImageAttachment = z.infer<typeof boardReviewImageAttachmentSchema>
export type BoardReviewAttachment = z.infer<typeof boardReviewAttachmentSchema>

export function parseBoardReviewAttachment(metadata: unknown): BoardReviewAttachment | null {
  if (!metadata || typeof metadata !== "object") return null
  const parsed = boardReviewAttachmentMetadataSchema.safeParse(metadata)
  return parsed.success ? parsed.data.attachment : null
}

export function parseBoardReviewImageAttachment(metadata: unknown): BoardReviewImageAttachment | null {
  const att = parseBoardReviewAttachment(metadata)
  return att?.kind === "image" ? att : null
}
