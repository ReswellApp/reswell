import { z } from "zod"

export const marketplaceMessagePdfAttachmentSchema = z.object({
  kind: z.literal("pdf"),
  bucket: z.string().min(1),
  path: z.string().min(1),
  file_name: z.string().min(1).max(500),
  mime_type: z.literal("application/pdf"),
  size_bytes: z.number().int().positive(),
})

export const marketplaceMessageAttachmentMetadataSchema = z.object({
  attachment: marketplaceMessagePdfAttachmentSchema,
})

export type MarketplaceMessagePdfAttachment = z.infer<typeof marketplaceMessagePdfAttachmentSchema>

export function parseMarketplaceMessagePdfAttachment(
  metadata: unknown,
): MarketplaceMessagePdfAttachment | null {
  if (!metadata || typeof metadata !== "object") return null
  const r = marketplaceMessageAttachmentMetadataSchema.safeParse(metadata)
  return r.success ? r.data.attachment : null
}
