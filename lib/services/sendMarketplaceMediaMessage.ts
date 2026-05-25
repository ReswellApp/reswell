import { createServiceRoleClient } from "@/lib/supabase/server"
import { insertFraudMessageCapturedContent } from "@/lib/db/fraudMessages"
import { findMessagesSupportTicketMetaByConversationId } from "@/lib/db/contactMessages"
import { messageAppearsToSharePhoneNumber } from "@/lib/utils/detect-message-phone-sharing"
import { trackKlaviyoSupportTicketResponse } from "@/lib/klaviyo/track-support-ticket-response"
import { trackKlaviyoMessageSent } from "@/lib/klaviyo/track-message-sent"
import { MESSAGE_BLOCKED_PHONE_ERROR } from "@/lib/messages/policy-errors"
import {
  MARKETPLACE_MESSAGE_ATTACHMENTS_BUCKET,
  composeMediaAttachmentMessageBody,
  marketplaceMessageAttachmentMetadataSchema,
  marketplaceMessageAttachmentSchema,
  type MarketplaceMessageAttachment,
} from "@/lib/validations/marketplace-message-attachment"

export type SendMarketplaceMediaMessageResult =
  | {
      ok: true
      message: {
        id: string
        content: string
        sender_id: string
        created_at: string
        is_read: boolean
        metadata: { attachment: MarketplaceMessageAttachment }
      }
    }
  | { ok: false; error: string; status?: number }

function attachmentPathBelongsToConversation(path: string, conversationId: string): boolean {
  const prefix = `${conversationId}/`
  return path.startsWith(prefix) && path.length > prefix.length
}

export async function sendMarketplaceMediaMessage(input: {
  conversationId: string
  senderId: string
  attachment: Omit<MarketplaceMessageAttachment, "bucket">
  caption?: string | null
}): Promise<SendMarketplaceMediaMessageResult> {
  const { conversationId, senderId, caption } = input

  const attachmentParsed = marketplaceMessageAttachmentSchema.safeParse({
    ...input.attachment,
    bucket: MARKETPLACE_MESSAGE_ATTACHMENTS_BUCKET,
  })
  if (!attachmentParsed.success) {
    return { ok: false, error: "Invalid attachment", status: 400 }
  }

  const attachment = attachmentParsed.data
  if (!attachmentPathBelongsToConversation(attachment.path, conversationId)) {
    return { ok: false, error: "Invalid attachment path", status: 400 }
  }

  const service = createServiceRoleClient()
  const { data: conv, error: convErr } = await service
    .from("conversations")
    .select("id, buyer_id, seller_id, listing_id")
    .eq("id", conversationId)
    .maybeSingle()

  if (convErr || !conv) {
    return { ok: false, error: "Conversation not found", status: 404 }
  }

  if (senderId !== conv.buyer_id && senderId !== conv.seller_id) {
    return { ok: false, error: "Forbidden", status: 403 }
  }

  const objectName = attachment.path.slice(conversationId.length + 1)
  const { data: listed, error: listErr } = await service.storage
    .from(MARKETPLACE_MESSAGE_ATTACHMENTS_BUCKET)
    .list(conversationId, { search: objectName, limit: 1 })

  if (listErr || !listed?.some((item) => item.name === objectName)) {
    return { ok: false, error: "Attachment not found in storage", status: 400 }
  }

  const defaultBody = composeMediaAttachmentMessageBody(
    attachment.kind === "video" ? "video" : "image",
  )
  const trimmedCaption = caption?.trim() ?? ""
  const content = (trimmedCaption || defaultBody).slice(0, 8000)

  if (trimmedCaption && messageAppearsToSharePhoneNumber(trimmedCaption)) {
    const receiverId = senderId === conv.buyer_id ? conv.seller_id : conv.buyer_id
    try {
      await insertFraudMessageCapturedContent(service, {
        conversationId,
        senderId,
        recipientId: receiverId,
        listingId: conv.listing_id,
        content: trimmedCaption,
      })
    } catch (e) {
      console.error("[sendMarketplaceMediaMessage] fraud_messages insert:", e)
    }
    return { ok: false, error: MESSAGE_BLOCKED_PHONE_ERROR, status: 400 }
  }

  const metadata = { attachment }
  const parsedMeta = marketplaceMessageAttachmentMetadataSchema.safeParse(metadata)
  if (!parsedMeta.success) {
    return { ok: false, error: "Invalid metadata", status: 500 }
  }

  const { data: inserted, error: insErr } = await service
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content,
      metadata: parsedMeta.data,
    })
    .select("id, content, sender_id, created_at, is_read, metadata")
    .single()

  if (insErr || !inserted) {
    console.error("[sendMarketplaceMediaMessage] insert:", insErr)
    return { ok: false, error: "Could not send message", status: 500 }
  }

  await service
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversationId)

  const receiverId = senderId === conv.buyer_id ? conv.seller_id : conv.buyer_id
  const { data: senderProfile } = await service
    .from("profiles")
    .select("display_name, shop_name, is_shop")
    .eq("id", senderId)
    .maybeSingle()

  void trackKlaviyoMessageSent({
    senderUserId: senderId,
    receiverUserId: receiverId,
    message: content,
    conversationId,
    listingId: conv.listing_id,
    messageId: inserted.id as string,
    sentAt: inserted.created_at as string,
    sessionSender: {
      email: null,
      profile: senderProfile,
    },
  })

  try {
    const ticketMeta = await findMessagesSupportTicketMetaByConversationId(service, conversationId)
    const supportStaffReply = senderId === conv.seller_id && ticketMeta != null && ticketMeta.email.trim() !== ""
    if (supportStaffReply) {
      void trackKlaviyoSupportTicketResponse({
        supportTicketId: ticketMeta.id,
        email: ticketMeta.email.trim(),
        externalId: ticketMeta.user_id,
        response: content,
        responseType: "support_dm_reply",
        uniqueId: `support-ticket-response-dm-${inserted.id as string}`,
      })
    }
  } catch {
    // Missing service role locally — Response metric skipped for support DM attribution.
  }

  const metaRow = inserted.metadata as unknown
  const att = marketplaceMessageAttachmentMetadataSchema.safeParse(metaRow)
  if (!att.success) {
    return { ok: false, error: "Message created with invalid shape", status: 500 }
  }

  return {
    ok: true,
    message: {
      id: inserted.id as string,
      content: inserted.content as string,
      sender_id: inserted.sender_id as string,
      created_at: inserted.created_at as string,
      is_read: inserted.is_read as boolean,
      metadata: att.data,
    },
  }
}
