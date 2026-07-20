import { createServiceRoleClient } from "@/lib/supabase/server"
import { MARKETPLACE_MESSAGE_ATTACHMENTS_BUCKET } from "@/lib/validations/marketplace-message-attachment"

export type DiscardUnsentMessageAttachmentResult =
  | { ok: true }
  | { ok: false; error: string; status?: number }

function attachmentPathBelongsToConversation(path: string, conversationId: string): boolean {
  const prefix = `${conversationId}/`
  return path.startsWith(prefix) && path.length > prefix.length && !path.includes("..")
}

/**
 * Best-effort cleanup when the client uploaded bytes but the message was never
 * created (cancel, failed send, retry with a new object). Safe if the object
 * is already gone. Refuses paths that belong to an existing message.
 */
export async function discardUnsentMessageAttachment(input: {
  conversationId: string
  senderId: string
  path: string
}): Promise<DiscardUnsentMessageAttachmentResult> {
  const { conversationId, senderId, path } = input

  if (!attachmentPathBelongsToConversation(path, conversationId)) {
    return { ok: false, error: "Invalid attachment path", status: 400 }
  }

  const service = createServiceRoleClient()
  const { data: conv, error: convErr } = await service
    .from("conversations")
    .select("id, buyer_id, seller_id")
    .eq("id", conversationId)
    .maybeSingle()

  if (convErr || !conv) {
    return { ok: false, error: "Conversation not found", status: 404 }
  }

  if (senderId !== conv.buyer_id && senderId !== conv.seller_id) {
    return { ok: false, error: "Forbidden", status: 403 }
  }

  const { data: linked, error: linkErr } = await service
    .from("messages")
    .select("id")
    .eq("conversation_id", conversationId)
    .filter("metadata->attachment->>path", "eq", path)
    .limit(1)
    .maybeSingle()

  if (linkErr) {
    console.error("[discardUnsentMessageAttachment] message lookup:", linkErr)
    return { ok: false, error: "Could not discard attachment", status: 500 }
  }

  if (linked) {
    return { ok: false, error: "Attachment already sent", status: 409 }
  }

  const { error: rmErr } = await service.storage
    .from(MARKETPLACE_MESSAGE_ATTACHMENTS_BUCKET)
    .remove([path])

  if (rmErr) {
    console.error("[discardUnsentMessageAttachment] storage remove:", rmErr.message)
    // Object may already be gone — treat as success for cancel UX.
    if (!/not found|does not exist/i.test(rmErr.message)) {
      return { ok: false, error: "Could not discard attachment", status: 500 }
    }
  }

  return { ok: true }
}
