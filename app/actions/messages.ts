"use server"

import { createClient } from "@/lib/supabase/server"
import { trackKlaviyoMessageSent } from "@/lib/klaviyo/track-message-sent"

export async function sendListingMessage(input: {
  listing_id?: string | null
  seller_id: string
  content: string
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Unauthorized" as const }
  }

  const { listing_id, seller_id, content } = input

  if (!seller_id || !content?.trim()) {
    return { error: "Missing required fields" as const }
  }

  const body = content.trim()

  let conversation
  const { data: existingConv } = await supabase
    .from("conversations")
    .select("id")
    .eq("buyer_id", user.id)
    .eq("seller_id", seller_id)
    .eq("listing_id", listing_id || null)
    .single()

  if (existingConv) {
    conversation = existingConv
  } else {
    const { data: newConv, error: convError } = await supabase
      .from("conversations")
      .insert({
        buyer_id: user.id,
        seller_id,
        listing_id: listing_id || null,
      })
      .select("id")
      .single()

    if (convError) {
      return { error: "Failed to create conversation" as const }
    }
    conversation = newConv
  }

  const { data: inserted, error: msgError } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversation.id,
      sender_id: user.id,
      content: body,
    })
    .select("id, created_at")
    .single()

  if (msgError || !inserted) {
    return { error: "Failed to send message" as const }
  }

  await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversation.id)

  void trackKlaviyoMessageSent({
    senderUserId: user.id,
    receiverUserId: seller_id,
    message: body,
    conversationId: conversation.id,
    listingId: listing_id ?? null,
    messageId: inserted.id,
    sentAt: inserted.created_at,
  })

  return { success: true as const, conversation_id: conversation.id }
}

export async function sendConversationReply(input: {
  conversation_id: string
  content: string
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Unauthorized" as const }
  }

  const body = input.content?.trim()
  if (!body) {
    return { error: "Empty message" as const }
  }

  const { data: conv, error: convErr } = await supabase
    .from("conversations")
    .select("id, buyer_id, seller_id, listing_id")
    .eq("id", input.conversation_id)
    .single()

  if (convErr || !conv) {
    return { error: "Conversation not found" as const }
  }

  if (user.id !== conv.buyer_id && user.id !== conv.seller_id) {
    return { error: "Forbidden" as const }
  }

  const receiverId = user.id === conv.buyer_id ? conv.seller_id : conv.buyer_id

  const { data: inserted, error: msgError } = await supabase
    .from("messages")
    .insert({
      conversation_id: conv.id,
      sender_id: user.id,
      content: body,
    })
    .select("id, content, sender_id, created_at, is_read")
    .single()

  if (msgError || !inserted) {
    return { error: "Failed to send message" as const }
  }

  await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conv.id)

  void trackKlaviyoMessageSent({
    senderUserId: user.id,
    receiverUserId: receiverId,
    message: body,
    conversationId: conv.id,
    listingId: conv.listing_id,
    messageId: inserted.id,
    sentAt: inserted.created_at,
  })

  return { success: true as const, message: inserted }
}
