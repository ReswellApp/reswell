import { z } from "zod"

export const FORUM_ATTACHMENTS_BUCKET = "forum-attachments"

export const forumCommentImageAttachmentSchema = z.object({
  kind: z.literal("image"),
  bucket: z.string().min(1),
  path: z.string().min(1),
  file_name: z.string().min(1).max(500),
  mime_type: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
  size_bytes: z.number().int().positive(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
})

export const forumCommentAttachmentSchema = forumCommentImageAttachmentSchema

export const forumCommentAttachmentMetadataSchema = z.object({
  attachment: forumCommentAttachmentSchema,
  opening_post: z.literal(true).optional(),
})

export const forumCommentAttachmentInputSchema = forumCommentImageAttachmentSchema.omit({ bucket: true })

export type ForumCommentImageAttachment = z.infer<typeof forumCommentImageAttachmentSchema>
export type ForumCommentAttachment = z.infer<typeof forumCommentAttachmentSchema>

export function parseForumCommentAttachment(metadata: unknown): ForumCommentAttachment | null {
  if (!metadata || typeof metadata !== "object") return null
  const parsed = forumCommentAttachmentMetadataSchema.safeParse(metadata)
  return parsed.success ? parsed.data.attachment : null
}

export function parseForumCommentImageAttachment(metadata: unknown): ForumCommentImageAttachment | null {
  const att = parseForumCommentAttachment(metadata)
  return att?.kind === "image" ? att : null
}

export function composeForumCommentImageBody(): string {
  return "Photo"
}

export function isForumCommentOpeningPost(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object") return false
  return (metadata as { opening_post?: boolean }).opening_post === true
}

export type SentForumCommentMedia = {
  id: string
  body: string
  created_at: string
  user_id: string
  parent_id: string | null
  metadata: { attachment: ForumCommentImageAttachment }
}
