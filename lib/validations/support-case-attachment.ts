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
