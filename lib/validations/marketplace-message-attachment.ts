import { z } from "zod"

export const MARKETPLACE_MESSAGE_ATTACHMENTS_BUCKET = "marketplace-message-attachments"

export const marketplaceMessagePdfAttachmentSchema = z.object({
  kind: z.literal("pdf"),
  bucket: z.string().min(1),
  path: z.string().min(1),
  file_name: z.string().min(1).max(500),
  mime_type: z.literal("application/pdf"),
  size_bytes: z.number().int().positive(),
})

export const marketplaceMessageImageAttachmentSchema = z.object({
  kind: z.literal("image"),
  bucket: z.string().min(1),
  path: z.string().min(1),
  file_name: z.string().min(1).max(500),
  mime_type: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
  size_bytes: z.number().int().positive(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
})

export const marketplaceMessageVideoAttachmentSchema = z.object({
  kind: z.literal("video"),
  bucket: z.string().min(1),
  path: z.string().min(1),
  file_name: z.string().min(1).max(500),
  mime_type: z.enum(["video/mp4", "video/quicktime", "video/webm"]),
  size_bytes: z.number().int().positive(),
})

export const marketplaceMessageAttachmentSchema = z.discriminatedUnion("kind", [
  marketplaceMessagePdfAttachmentSchema,
  marketplaceMessageImageAttachmentSchema,
  marketplaceMessageVideoAttachmentSchema,
])

export const marketplaceMessageAttachmentMetadataSchema = z.object({
  attachment: marketplaceMessageAttachmentSchema,
})

export const marketplaceMessageAttachmentInputSchema = z.discriminatedUnion("kind", [
  marketplaceMessagePdfAttachmentSchema.omit({ bucket: true }),
  marketplaceMessageImageAttachmentSchema.omit({ bucket: true }),
  marketplaceMessageVideoAttachmentSchema.omit({ bucket: true }),
])

export type MarketplaceMessagePdfAttachment = z.infer<typeof marketplaceMessagePdfAttachmentSchema>
export type MarketplaceMessageImageAttachment = z.infer<typeof marketplaceMessageImageAttachmentSchema>
export type MarketplaceMessageVideoAttachment = z.infer<typeof marketplaceMessageVideoAttachmentSchema>
export type MarketplaceMessageAttachment = z.infer<typeof marketplaceMessageAttachmentSchema>

export function parseMarketplaceMessageAttachment(metadata: unknown): MarketplaceMessageAttachment | null {
  if (!metadata || typeof metadata !== "object") return null
  const r = marketplaceMessageAttachmentMetadataSchema.safeParse(metadata)
  return r.success ? r.data.attachment : null
}

export function parseMarketplaceMessagePdfAttachment(
  metadata: unknown,
): MarketplaceMessagePdfAttachment | null {
  const att = parseMarketplaceMessageAttachment(metadata)
  return att?.kind === "pdf" ? att : null
}

export function parseMarketplaceMessageImageAttachment(
  metadata: unknown,
): MarketplaceMessageImageAttachment | null {
  const att = parseMarketplaceMessageAttachment(metadata)
  return att?.kind === "image" ? att : null
}

export function parseMarketplaceMessageVideoAttachment(
  metadata: unknown,
): MarketplaceMessageVideoAttachment | null {
  const att = parseMarketplaceMessageAttachment(metadata)
  return att?.kind === "video" ? att : null
}

export function composeMediaAttachmentMessageBody(kind: "image" | "video"): string {
  return kind === "image" ? "Photo" : "Video"
}
