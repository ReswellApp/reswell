"use server"

import { z } from "zod"
import { revalidateMessagesInboxForParticipants } from "@/lib/cache/revalidate-messages-inbox"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { findMessagesSupportTicketMetaByConversationId } from "@/lib/db/contactMessages"
import { getConversationForBuyerSellerListing, ensureConversationForBuyerSellerListing } from "@/lib/db/conversations"
import { insertFraudMessageCapturedContent } from "@/lib/db/fraudMessages"
import { loadMessagePolicyOptionsForSender } from "@/lib/messages/sender-policy-options"
import { detectMessagePolicyViolation } from "@/lib/utils/detect-message-policy-violation"
import { trackKlaviyoSupportTicketResponse } from "@/lib/klaviyo/track-support-ticket-response"
import { trackKlaviyoMessageSent } from "@/lib/klaviyo/track-message-sent"
import { MESSAGE_BLOCKED_POLICY_ERROR } from "@/lib/messages/policy-errors"
import type { MessagePolicyReasonCode } from "@/lib/messages/fraud-reason-codes"
import { sendSellerReviewRequestForOrder } from "@/lib/services/sellerReviewRequest"
import {
  composeLocationShareMessageBody,
  messageLocationMetadataSchema,
} from "@/lib/validations/message-location-metadata"
import { marketplaceMessageAttachmentInputSchema } from "@/lib/validations/marketplace-message-attachment"
import { sendMarketplaceMediaMessage } from "@/lib/services/sendMarketplaceMediaMessage"
import {
  loadOtherPartyProfile,
  type OtherPartyProfileSummary,
} from "@/lib/messages/profile-reviews-loader"

const sendConversationLocationReplySchema = z.object({
  conversation_id: z.string().uuid(),
  formattedAddress: z.string().min(1).max(500),
  latitude: z.number().gte(-90).lte(90),
  longitude: z.number().gte(-180).lte(180),
  placeId: z.string().min(1).max(256).optional(),
})

const sendSellerReviewRequestSchema = z.object({
  order_id: z.string().uuid(),
})

const sendConversationMediaReplySchema = z.object({
  conversation_id: z.string().uuid(),
  attachment: marketplaceMessageAttachmentInputSchema,
  caption: z.string().max(5000).optional(),
})

const marketplaceListingThreadSchema = z.object({
  listing_id: z.string().uuid(),
  other_user_id: z.string().uuid(),
})

type MarketplaceListingThreadContext =
  | {
      ok: true
      buyerId: string
      sellerId: string
      listingId: string
      viewerIsSeller: boolean
    }
  | { ok: false; error: string }

async function resolveMarketplaceListingThreadContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  listingId: string,
  otherUserId: string,
): Promise<MarketplaceListingThreadContext> {
  if (otherUserId === userId) {
    return { ok: false, error: "Invalid request." }
  }

  const { data: listing, error: listingErr } = await supabase
    .from("listings")
    .select("id, user_id")
    .eq("id", listingId)
    .maybeSingle()

  if (listingErr || !listing) {
    return { ok: false, error: "Listing not found." }
  }

  const sellerUserId = listing.user_id as string
  const viewerIsSeller = sellerUserId === userId
  const viewerIsBuyer = userId !== sellerUserId && otherUserId === sellerUserId

  if (!viewerIsSeller && !viewerIsBuyer) {
    return { ok: false, error: "You can’t open this conversation." }
  }

  if (viewerIsSeller && otherUserId === sellerUserId) {
    return { ok: false, error: "Invalid request." }
  }

  return {
    ok: true,
    buyerId: viewerIsSeller ? otherUserId : userId,
    sellerId: sellerUserId,
    listingId,
    viewerIsSeller,
  }
}

async function ensureMarketplaceConversationOnSend(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ctx: Extract<MarketplaceListingThreadContext, { ok: true }>,
): Promise<{ id: string } | null> {
  const existing = await getConversationForBuyerSellerListing(
    supabase,
    ctx.buyerId,
    ctx.sellerId,
    ctx.listingId,
  )
  if (existing) {
    return { id: existing.id }
  }

  if (!ctx.viewerIsSeller) {
    const { data: created, error: createErr } = await supabase
      .from("conversations")
      .insert({
        buyer_id: ctx.buyerId,
        seller_id: ctx.sellerId,
        listing_id: ctx.listingId,
      })
      .select("id")
      .single()

    if (createErr || !created) {
      return null
    }
    return { id: created.id as string }
  }

  let service
  try {
    service = createServiceRoleClient()
  } catch {
    return null
  }

  const { data: created, error: svcErr } = await service
    .from("conversations")
    .insert({
      buyer_id: ctx.buyerId,
      seller_id: ctx.sellerId,
      listing_id: ctx.listingId,
    })
    .select("id")
    .single()

  if (svcErr || !created) {
    console.error("[ensureMarketplaceConversationOnSend] seller-first thread insert:", svcErr)
    return null
  }

  return { id: created.id as string }
}

async function capturePolicyBlockedDmContent(row: {
  conversationId: string
  senderId: string
  recipientId: string
  listingId: string | null
  content: string
  reasonCode: MessagePolicyReasonCode
}) {
  try {
    const service = createServiceRoleClient()
    await insertFraudMessageCapturedContent(service, {
      conversationId: row.conversationId,
      senderId: row.senderId,
      recipientId: row.recipientId,
      listingId: row.listingId,
      content: row.content,
      reasonCode: row.reasonCode,
    })
  } catch (e) {
    console.error("[messages] Could not persist fraud_messages row:", e)
  }
}

function policyBlockedSendResult(reasonCode: MessagePolicyReasonCode) {
  return { error: MESSAGE_BLOCKED_POLICY_ERROR, policyReason: reasonCode } as const
}

/**
 * Resolves an existing buyer↔seller thread for a listing without creating one.
 * New threads are created only when the user sends the first message.
 */
export async function ensureMarketplaceThread(input: unknown) {
  const parsed = marketplaceListingThreadSchema.safeParse(input)
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

  const ctx = await resolveMarketplaceListingThreadContext(
    supabase,
    user.id,
    listing_id,
    other_user_id,
  )
  if (!ctx.ok) {
    return { error: ctx.error as "Invalid request." | "Listing not found." | "You can’t open this conversation." }
  }

  const existing = await getConversationForBuyerSellerListing(
    supabase,
    ctx.buyerId,
    ctx.sellerId,
    listing_id,
  )

  if (existing) {
    return { conversation_id: existing.id as string }
  }

  return { compose: true as const }
}

/**
 * Ensures the listing conversation exists (creating it if needed) so media can be
 * sent as the first message — uploads are conversation-scoped.
 */
export async function ensureMarketplaceListingConversation(input: unknown) {
  const parsed = marketplaceListingThreadSchema.safeParse(input)
  if (!parsed.success) {
    return { error: "Invalid request." as const }
  }

  const { listing_id, other_user_id } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Unauthorized" as const }
  }

  const ctx = await resolveMarketplaceListingThreadContext(
    supabase,
    user.id,
    listing_id,
    other_user_id,
  )
  if (!ctx.ok) {
    return { error: ctx.error as "Invalid request." | "Listing not found." | "You can’t open this conversation." }
  }

  const conversation = await ensureConversationForBuyerSellerListing(
    supabase,
    ctx.buyerId,
    ctx.sellerId,
    listing_id,
  )
  if (!conversation) {
    return { error: "Could not start conversation." as const }
  }

  return { conversation_id: conversation.id }
}

/** Creates the listing thread on first send (buyer or seller). */
export async function sendMarketplaceListingMessage(input: unknown) {
  const parsed = marketplaceListingThreadSchema
    .extend({ content: z.string().min(1).max(5000) })
    .safeParse(input)
  if (!parsed.success) {
    return { error: "Invalid request." as const }
  }

  const { listing_id, other_user_id, content } = parsed.data
  const body = content.trim()
  if (!body) {
    return { error: "Empty message" as const }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Unauthorized" as const }
  }

  const ctx = await resolveMarketplaceListingThreadContext(
    supabase,
    user.id,
    listing_id,
    other_user_id,
  )
  if (!ctx.ok) {
    return { error: ctx.error }
  }

  const conversation = await ensureMarketplaceConversationOnSend(supabase, ctx)
  if (!conversation) {
    return { error: "Could not start the conversation." as const }
  }

  const receiverId = user.id === ctx.buyerId ? ctx.sellerId : ctx.buyerId

  const policyOptions = await loadMessagePolicyOptionsForSender(supabase, user.id)
  const policyViolation = detectMessagePolicyViolation(body, policyOptions)
  if (policyViolation) {
    await capturePolicyBlockedDmContent({
      conversationId: conversation.id,
      senderId: user.id,
      recipientId: receiverId,
      listingId: listing_id,
      content: body,
      reasonCode: policyViolation,
    })
    return policyBlockedSendResult(policyViolation)
  }

  const { data: inserted, error: msgError } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversation.id,
      sender_id: user.id,
      content: body,
    })
    .select("id, content, sender_id, created_at, is_read")
    .single()

  if (msgError || !inserted) {
    console.error("[sendMarketplaceListingMessage] message insert:", msgError)
    return { error: "Failed to send message" as const }
  }

  await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversation.id)

  revalidateMessagesInboxForParticipants(ctx.buyerId, ctx.sellerId)

  const { data: senderProfile } = await supabase
    .from("profiles")
    .select("display_name, shop_name, is_shop")
    .eq("id", user.id)
    .maybeSingle()

  void trackKlaviyoMessageSent({
    senderUserId: user.id,
    receiverUserId: receiverId,
    message: body,
    conversationId: conversation.id,
    listingId: listing_id,
    messageId: inserted.id,
    sentAt: inserted.created_at,
    sessionSender: {
      email: user.email ?? null,
      profile: senderProfile,
    },
  })

  return {
    success: true as const,
    conversation_id: conversation.id,
    message: inserted,
  }
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

  if (!listing_id) {
    return { error: "Listing is required to start a conversation." as const }
  }

  let conversation: { id: string }
  const existing = await getConversationForBuyerSellerListing(supabase, user.id, seller_id, listing_id)

  if (existing) {
    conversation = { id: existing.id }
  } else {
    const ensured = await ensureConversationForBuyerSellerListing(
      supabase,
      user.id,
      seller_id,
      listing_id,
    )
    if (!ensured) {
      return { error: "Failed to create conversation" as const }
    }
    conversation = ensured
  }

  const policyOptions = await loadMessagePolicyOptionsForSender(supabase, user.id)
  const policyViolation = detectMessagePolicyViolation(body, policyOptions)
  if (policyViolation) {
    await capturePolicyBlockedDmContent({
      conversationId: conversation.id,
      senderId: user.id,
      recipientId: seller_id,
      listingId: listing_id ?? null,
      content: body,
      reasonCode: policyViolation,
    })
    return policyBlockedSendResult(policyViolation)
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
    console.error("[sendListingMessage] message insert:", msgError)
    return { error: "Failed to send message" as const }
  }

  await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversation.id)

  revalidateMessagesInboxForParticipants(user.id, seller_id)

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

  const policyOptions = await loadMessagePolicyOptionsForSender(supabase, user.id)
  const policyViolation = detectMessagePolicyViolation(body, policyOptions)
  if (policyViolation) {
    await capturePolicyBlockedDmContent({
      conversationId: conv.id,
      senderId: user.id,
      recipientId: receiverId,
      listingId: conv.listing_id,
      content: body,
      reasonCode: policyViolation,
    })
    return policyBlockedSendResult(policyViolation)
  }

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
    console.error("[sendConversationReply] message insert:", msgError)
    return { error: "Failed to send message" as const }
  }

  await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conv.id)

  revalidateMessagesInboxForParticipants(conv.buyer_id, conv.seller_id)

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

export async function sendConversationMediaReply(input: unknown) {
  const parsed = sendConversationMediaReplySchema.safeParse(input)
  if (!parsed.success) {
    return { error: "Invalid attachment" as const }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Unauthorized" as const }
  }

  const policyOptions = await loadMessagePolicyOptionsForSender(supabase, user.id)

  const result = await sendMarketplaceMediaMessage({
    conversationId: parsed.data.conversation_id,
    senderId: user.id,
    attachment: parsed.data.attachment,
    caption: parsed.data.caption,
    allowPhoneSharing: policyOptions.allowPhoneSharing,
  })

  if (!result.ok) {
    if (result.policyReason) {
      return { error: result.error, policyReason: result.policyReason }
    }
    return { error: result.error }
  }

  return { success: true as const, message: result.message }
}

export async function sendConversationLocationReply(input: unknown) {
  const parsed = sendConversationLocationReplySchema.safeParse(input)
  if (!parsed.success) {
    return { error: "Invalid location" as const }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Unauthorized" as const }
  }

  const formattedAddress = parsed.data.formattedAddress.trim()
  if (!formattedAddress) {
    return { error: "Invalid location" as const }
  }

  const { data: conv, error: convErr } = await supabase
    .from("conversations")
    .select("id, buyer_id, seller_id, listing_id")
    .eq("id", parsed.data.conversation_id)
    .single()

  if (convErr || !conv) {
    return { error: "Conversation not found" as const }
  }

  if (user.id !== conv.buyer_id && user.id !== conv.seller_id) {
    return { error: "Forbidden" as const }
  }

  const receiverId = user.id === conv.buyer_id ? conv.seller_id : conv.buyer_id

  const policyOptions = await loadMessagePolicyOptionsForSender(supabase, user.id)
  const policyViolation = detectMessagePolicyViolation(formattedAddress, policyOptions)
  if (policyViolation) {
    await capturePolicyBlockedDmContent({
      conversationId: conv.id,
      senderId: user.id,
      recipientId: receiverId,
      listingId: conv.listing_id,
      content: formattedAddress,
      reasonCode: policyViolation,
    })
    return policyBlockedSendResult(policyViolation)
  }

  const metadataPayload = messageLocationMetadataSchema.parse({
    kind: "location_share",
    formattedAddress,
    latitude: parsed.data.latitude,
    longitude: parsed.data.longitude,
    ...(parsed.data.placeId ? { placeId: parsed.data.placeId } : {}),
  })

  const body = composeLocationShareMessageBody(formattedAddress)

  const { data: inserted, error: msgError } = await supabase
    .from("messages")
    .insert({
      conversation_id: conv.id,
      sender_id: user.id,
      content: body,
      metadata: metadataPayload,
    })
    .select("id, content, sender_id, created_at, is_read, metadata")
    .single()

  if (msgError || !inserted) {
    console.error("[sendConversationLocationReply] message insert:", msgError)
    return { error: "Failed to send message" as const }
  }

  await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conv.id)

  revalidateMessagesInboxForParticipants(conv.buyer_id, conv.seller_id)

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

const CONVERSATION_THREAD_SELECT = `
  *,
  listing:listings(id, title, price, section, slug, listing_images(url, thumbnail_url, is_primary), minimum_offer_pct),
  buyer:profiles!conversations_buyer_id_fkey(id, display_name, avatar_url, shop_verified),
  seller:profiles!conversations_seller_id_fkey(id, display_name, avatar_url, shop_verified)
`

const CONVERSATION_THREAD_OFFER_SELECT =
  "id, status, current_amount, initial_amount, buyer_id, seller_id, listing_id, seller_initiated, expires_at, offer_timeline, fulfillment, shipping_amount, line_items"

const CONVERSATION_THREAD_LISTING_SELECT =
  "id, title, price, section, slug, listing_images(url, thumbnail_url, is_primary), minimum_offer_pct"

export type ConversationThreadListingOption = {
  conversationId: string
  listingId: string | null
  listingTitle: string | null
  listingImages: unknown
  lastMessageAt: string
}

export type ConversationThreadData = {
  currentUserId: string
  conversation: Record<string, unknown> | null
  listingThreads: ConversationThreadListingOption[]
  messages: Record<string, unknown>[]
  offers: Record<string, unknown>[]
  threadListings: Record<string, unknown>[]
  otherPartyProfile: OtherPartyProfileSummary | null
}

/**
 * Server-side thread loader: resolves the signed-in user from the request session
 * (reliable, unlike a client-side `getUser()`), verifies participation, then reads
 * the conversation, messages, offers, and sibling listing threads via the service
 * role. Also marks the thread read. Returns everything the client needs to render
 * without depending on a browser Supabase session.
 */
export async function loadConversationThread(
  conversationId: string,
): Promise<{ error: string } | ConversationThreadData> {
  if (typeof conversationId !== "string" || !z.string().uuid().safeParse(conversationId).success) {
    return { error: "Invalid request" }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Unauthorized" }
  }

  const service = createServiceRoleClient()

  const { data: convData, error: convErr } = await service
    .from("conversations")
    .select(CONVERSATION_THREAD_SELECT)
    .eq("id", conversationId)
    .maybeSingle()

  if (convErr || !convData) {
    return { error: "Conversation not found" }
  }

  const conv = convData as Record<string, unknown>
  const buyerId = conv.buyer_id as string
  const sellerId = conv.seller_id as string

  if (user.id !== buyerId && user.id !== sellerId) {
    return { error: "Conversation not found" }
  }

  const otherUserId = user.id === buyerId ? sellerId : buyerId

  const [{ data: siblingRows }, { data: msgData }, otherPartyProfile] = await Promise.all([
    service
      .from("conversations")
      .select(
        `id, listing_id, last_message_at, listing:listings(id, title, listing_images(url, thumbnail_url, is_primary)), messages(id)`,
      )
      .eq("buyer_id", buyerId)
      .eq("seller_id", sellerId)
      .order("last_message_at", { ascending: false }),
    service
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true }),
    loadOtherPartyProfile(service, otherUserId).catch(() => null),
  ])

  const listingThreads: ConversationThreadListingOption[] = (siblingRows ?? [])
    .filter((row) => {
      const messages = (row as { messages?: unknown[] }).messages
      return Array.isArray(messages) && messages.length > 0
    })
    .map((row) => {
      const listing = Array.isArray(row.listing) ? row.listing[0] : row.listing
      return {
        conversationId: row.id as string,
        listingId: (row.listing_id as string | null) ?? null,
        listingTitle: (listing as { title?: string | null } | null)?.title ?? null,
        listingImages:
          (listing as { listing_images?: unknown } | null)?.listing_images ?? null,
        lastMessageAt: row.last_message_at as string,
      }
    })

  const messages = (msgData ?? []) as Record<string, unknown>[]

  const offerIds = [
    ...new Set(messages.map((m) => m.offer_id).filter(Boolean)),
  ] as string[]

  let offers: Record<string, unknown>[] = []
  if (offerIds.length > 0) {
    const { data: orows } = await service
      .from("offers")
      .select(CONVERSATION_THREAD_OFFER_SELECT)
      .in("id", offerIds)
    offers = (orows ?? []) as Record<string, unknown>[]
  }

  const threadListingIds = [
    ...new Set(
      offers
        .map((o) => o.listing_id)
        .filter((lid): lid is string => typeof lid === "string" && lid.length > 0),
    ),
  ]
  if (conv.listing_id && typeof conv.listing_id === "string") {
    if (!threadListingIds.includes(conv.listing_id)) {
      threadListingIds.push(conv.listing_id)
    }
  }

  let threadListings: Record<string, unknown>[] = []
  if (threadListingIds.length > 0) {
    const { data: listingRows } = await service
      .from("listings")
      .select(CONVERSATION_THREAD_LISTING_SELECT)
      .in("id", threadListingIds)
    threadListings = (listingRows ?? []) as Record<string, unknown>[]
  }

  await service
    .from("messages")
    .update({ is_read: true })
    .eq("conversation_id", conversationId)
    .neq("sender_id", user.id)

  await service
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", user.id)
    .eq("is_read", false)

  revalidateMessagesInboxForParticipants(buyerId, sellerId)

  return {
    currentUserId: user.id,
    conversation: conv,
    listingThreads,
    messages,
    offers,
    threadListings,
    otherPartyProfile,
  }
}
