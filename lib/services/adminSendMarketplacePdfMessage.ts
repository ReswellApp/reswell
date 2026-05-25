import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  MARKETPLACE_MESSAGE_ATTACHMENTS_BUCKET,
  marketplaceMessageAttachmentMetadataSchema,
  type MarketplaceMessagePdfAttachment,
} from "@/lib/validations/marketplace-message-attachment"

/** Hard cap aligned with storage bucket file_size_limit. */
export const MARKETPLACE_MESSAGE_PDF_MAX_BYTES = 12 * 1024 * 1024

function displayFileName(raw: string): string {
  const base = raw.replace(/^.*[/\\]/, "").trim() || "document.pdf"
  const cleaned = base.replace(/[^\w.\- ()[\]]+/g, "_").slice(0, 200)
  return cleaned.toLowerCase().endsWith(".pdf") ? cleaned : `${cleaned}.pdf`
}

export type AdminSendMarketplacePdfResult =
  | {
      ok: true
      message: {
        id: string
        conversation_id: string
        sender_id: string
        content: string
        created_at: string
        metadata: { attachment: MarketplaceMessagePdfAttachment }
      }
    }
  | { ok: false; error: string; status: number }

/**
 * Uploads a PDF to private storage and inserts a messages row as the given staff user.
 * Uses the service role so the sender need not be a conversation participant.
 */
export async function adminSendMarketplacePdfMessage(input: {
  conversationId: string
  staffUserId: string
  pdfBytes: Uint8Array
  clientFileName: string
  caption?: string | null
}): Promise<AdminSendMarketplacePdfResult> {
  const { conversationId, staffUserId, pdfBytes, clientFileName, caption } = input

  if (pdfBytes.byteLength === 0) {
    return { ok: false, error: "Empty file", status: 400 }
  }
  if (pdfBytes.byteLength > MARKETPLACE_MESSAGE_PDF_MAX_BYTES) {
    return { ok: false, error: "PDF is too large (max 12 MB)", status: 400 }
  }

  const supabase = createServiceRoleClient()

  const { data: conv, error: convErr } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .maybeSingle()

  if (convErr || !conv) {
    return { ok: false, error: "Conversation not found", status: 404 }
  }

  const safeName = displayFileName(clientFileName)
  const path = `${conversationId}/${crypto.randomUUID()}.pdf`

  const { error: upErr } = await supabase.storage
    .from(MARKETPLACE_MESSAGE_ATTACHMENTS_BUCKET)
    .upload(path, Buffer.from(pdfBytes), { contentType: "application/pdf", upsert: false })

  if (upErr) {
    console.error("[adminSendMarketplacePdfMessage] upload:", upErr)
    return { ok: false, error: "Could not upload file", status: 500 }
  }

  const attachment: MarketplaceMessagePdfAttachment = {
    kind: "pdf",
    bucket: MARKETPLACE_MESSAGE_ATTACHMENTS_BUCKET,
    path,
    file_name: safeName,
    mime_type: "application/pdf",
    size_bytes: pdfBytes.byteLength,
  }

  const metadata = { attachment }
  const parsedMeta = marketplaceMessageAttachmentMetadataSchema.safeParse(metadata)
  if (!parsedMeta.success) {
    void supabase.storage.from(MARKETPLACE_MESSAGE_ATTACHMENTS_BUCKET).remove([path])
    return { ok: false, error: "Invalid metadata", status: 500 }
  }

  const content = (caption?.trim() || `Attachment: ${safeName}`).slice(0, 8000)

  const { data: inserted, error: insErr } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: staffUserId,
      content,
      metadata: parsedMeta.data,
    })
    .select("id, conversation_id, sender_id, content, created_at, metadata")
    .single()

  if (insErr || !inserted) {
    console.error("[adminSendMarketplacePdfMessage] insert:", insErr)
    void supabase.storage.from(MARKETPLACE_MESSAGE_ATTACHMENTS_BUCKET).remove([path])
    return { ok: false, error: "Could not send message", status: 500 }
  }

  await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversationId)

  const metaRow = inserted.metadata as unknown
  const att = marketplaceMessageAttachmentMetadataSchema.safeParse(metaRow)
  if (!att.success) {
    return { ok: false, error: "Message created with invalid shape", status: 500 }
  }

  return {
    ok: true,
    message: {
      id: inserted.id as string,
      conversation_id: inserted.conversation_id as string,
      sender_id: inserted.sender_id as string,
      content: inserted.content as string,
      created_at: inserted.created_at as string,
      metadata: att.data as { attachment: MarketplaceMessagePdfAttachment },
    },
  }
}
