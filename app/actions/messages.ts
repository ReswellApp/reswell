"use server"

import { z } from "zod"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { findMessagesSupportTicketMetaByConversationId } from "@/lib/db/contactMessages"
import { getConversationForBuyerSeller } from "@/lib/db/conversations"
import { trackKlaviyoSupportTicketResponse } from "@/lib/klaviyo/track-support-ticket-response"
import { trackKlaviyoMessageSent } from "@/lib/klaviyo/track-message-sent"
import { sendSellerReviewRequestForOrder } from "@/lib/services/sellerReviewRequest"

const sendSellerReviewRequestSchema = z.object({
  order_id: z.string().uuid(),
})

const ensureMarketplaceThreadSchema = z.object({
  listing_id: z.string().uuid(),
  other_user_id: z.string().uuid(),
})

/**
 * Opens the single buyer↔seller thread for a listing, creating it if allowed.
 * Buyers create threads via RLS; sellers need a service-role insert when they go first.
 */
export async function ensureMarketplaceThread(input: unknown) {
  const parsed = ensureMarketplaceThreadSchema.safeParse(input)
  if (!parsed.success) {
    return { error: "Invalid request." as const }
  }

  const { listing_id, other_user_id } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Unauthorized." as const }
  }

  if (other_user_id === user.id) {
    return { error: "Invalid request." as const }
  }

  const { data: listing, error: listingErr } = await supabase
    .from("listings")
    .select("id, user_id")
    .eq("id", listing_id)
    .maybeSingle()

  if (listingErr || !listing) {
    return { error: "Listing not found." as const }
  }

  const sellerUserId = listing.user_id as string
  const viewerIsSeller = sellerUserId === user.id
  /** Buyer messaging the listing owner: `other_user_id` must be the seller. */
  const viewerIsBuyer = user.id !== sellerUserId && other_user_id === sellerUserId

  if (!viewerIsSeller && !viewerIsBuyer) {
    return { error: "You can’t open this conversation." as const }
  }

  if (viewerIsSeller && other_user_id === sellerUserId) {
    return { error: "Invalid request." as const }
  }

  const buyerId = viewerIsSeller ? other_user_id : user.id
  const sellerId = sellerUserId

  const existing = await getConversationForBuyerSeller(supabase, buyerId, sellerId)

  if (existing) {
    if (existing.listing_id !== listing_id) {
      await supabase.from("conversations").update({ listing_id }).eq("id", existing.id)
    }
    return { conversation_id: existing.id as string }
  }

  if (viewerIsBuyer) {
    const { data: created, error: createErr } = await supabase
      .from("conversations")
      .insert({
        buyer_id: buyerId,
        seller_id: sellerId,
        listing_id,
      })
      .select("id")
      .single()

    if (createErr || !created) {
      return { error: "Could not start the conversation." as const }
    }
    return { conversation_id: created.id as string }
  }

  let service
  try {
    service = createServiceRoleClient()
  } catch {
    return { error: "Messaging is temporarily unavailable." as const }
  }

  const { data: created, error: svcErr } = await service
    .from("conversations")
    .insert({
      buyer_id: buyerId,
      seller_id: sellerId,
      listing_id,
    })
    .select("id")
    .single()

  if (svcErr || !created) {
    console.error("[ensureMarketplaceThread] seller-first thread insert:", svcErr)
    return { error: "Could not start the conversation." as const }
  }

  return { conversation_id: created.id as string }
}

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

  let conversation: { id: string }
  const existing = await getConversationForBuyerSeller(supabase, user.id, seller_id)

  if (existing) {
    conversation = { id: existing.id }
    if (listing_id && existing.listing_id !== listing_id) {
      await supabase.from("conversations").update({ listing_id }).eq("id", existing.id)
    }
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
    if (!newConv) {
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

  const { data: senderProfile } = await supabase
    .from("profiles")
    .select("display_name, shop_name, is_shop")
    .eq("id", user.id)
    .maybeSingle()

  void trackKlaviyoMessageSent({
    senderUserId: user.id,
    receiverUserId: seller_id,
    message: body,
    conversationId: conversation.id,
    listingId: listing_id ?? null,
    messageId: inserted.id,
    sentAt: inserted.created_at,
    sessionSender: {
      email: user.email ?? null,
      profile: senderProfile,
    },
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

  const { data: senderProfile } = await supabase
    .from("profiles")
    .select("display_name, shop_name, is_shop")
    .eq("id", user.id)
    .maybeSingle()

  void trackKlaviyoMessageSent({
    senderUserId: user.id,
    receiverUserId: receiverId,
    message: body,
    conversationId: conv.id,
    listingId: conv.listing_id,
    messageId: inserted.id,
    sentAt: inserted.created_at,
    sessionSender: {
      email: user.email ?? null,
      profile: senderProfile,
    },
  })

  try {
    const service = createServiceRoleClient()
    const ticketMeta = await findMessagesSupportTicketMetaByConversationId(service, conv.id)
    /** Support teammate is always `seller_id` in member↔support threads opened from Messages. */
    const supportStaffReply = user.id === conv.seller_id && ticketMeta != null && ticketMeta.email.trim() !== ""

    if (supportStaffReply) {
      void trackKlaviyoSupportTicketResponse({
        supportTicketId: ticketMeta.id,
        email: ticketMeta.email.trim(),
        externalId: ticketMeta.user_id,
        response: body,
        responseType: "support_dm_reply",
        uniqueId: `support-ticket-response-dm-${inserted.id}`,
      })
    }
  } catch {
    // Missing service role locally — Response metric skipped for support DM attribution.
  }

  return { success: true as const, message: inserted }
}

export async function sendSellerReviewRequest(input: unknown) {
  const parsed = sendSellerReviewRequestSchema.safeParse(input)
  if (!parsed.success) {
    return { error: "Invalid request" as const }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Unauthorized" as const }
  }

  const result = await sendSellerReviewRequestForOrder(supabase, user.id, parsed.data.order_id, {
    email: user.email ?? null,
  })

  if (!result.ok) {
    return { error: result.error }
  }

  return { success: true as const, conversation_id: result.conversationId }
}
