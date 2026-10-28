import { z } from "zod"

export const SUPPORT_CASE_ATTACHMENTS_BUCKET = "support-case-attachments"

export const SUPPORT_CASE_MAX_EVIDENCE_PHOTOS = 8

export const supportEvidenceKindSchema = z.enum([
  "damage",
  "packing",
  "listing_compare",
  "other",
])

export const supportCaseAttachmentInputSchema = z.object({
  kind: z.literal("image"),
  path: z.string().min(1).max(500),
  file_name: z.string().min(1).max(500),
  mime_type: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
  size_bytes: z.number().int().positive().max(20_971_520),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  evidence_kind: supportEvidenceKindSchema.optional(),
})

export const supportCaseEvidenceListSchema = z
  .array(supportCaseAttachmentInputSchema)
  .max(SUPPORT_CASE_MAX_EVIDENCE_PHOTOS)

export type SupportCaseAttachmentInput = z.infer<typeof supportCaseAttachmentInputSchema>

/** Stored on support_case_messages.metadata for in-thread photos. */
export const supportCaseMessageImageAttachmentSchema = z.object({
  kind: z.literal("image"),
  bucket: z.string().min(1),
  path: z.string().min(1).max(500),
  file_name: z.string().min(1).max(500),
  mime_type: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
  size_bytes: z.number().int().positive(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
})

export const supportCaseMessageAttachmentMetadataSchema = z.object({
  attachment: supportCaseMessageImageAttachmentSchema,
})

export type SupportCaseMessageImageAttachment = z.infer<typeof supportCaseMessageImageAttachmentSchema>

export function parseSupportCaseMessageImageAttachment(metadata: unknown): SupportCaseMessageImageAttachment | null {
  if (!metadata || typeof metadata !== "object") return null
  const parsed = supportCaseMessageAttachmentMetadataSchema.safeParse(metadata)
  return parsed.success ? parsed.data.attachment : null
}

export function composeSupportCaseMediaMessageBody(): string {
  return "Photo"
}
